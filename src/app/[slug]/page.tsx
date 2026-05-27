// Ruta SEO programática catch-all.
// Patrón soportado:
//   /reparacion-{service}-{brand?}-{location?}
//
// Ejemplos:
//   /reparacion-lavadoras-mabe-guadalajara
//   /reparacion-lavadoras-guadalajara
//   /reparacion-lavadoras
//
// Decodifica el slug, busca service/brand/city y renderiza la landing con form.
// generateStaticParams pre-renderiza las combinaciones más relevantes.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Clock, BadgeCheck, MapPin, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { LeadForm } from "@/components/LeadForm";
import { buildLocalBusinessJsonLd } from "@/lib/seo";
import { findServiceContent } from "@/lib/service-content-store";

type Params = { slug: string };

type ParsedRoute = {
  serviceSlug: string;
  brandSlug: string | null;
  citySlug: string | null;
};

// Decodifica /reparacion-lavadoras-mabe-guadalajara usando los slugs reales
// de la BD (no asume estructura fija porque service/brand/city pueden tener guiones).
// Los slugs de servicio en la BD ya incluyen el prefijo (ej. "reparacion-lavadoras"),
// así que matcheamos contra el slug completo de la URL.
async function parseSlug(slug: string): Promise<ParsedRoute | null> {
  const [services, brands, cities] = await Promise.all([
    prisma.service.findMany({ select: { slug: true } }),
    prisma.brand.findMany({ select: { slug: true } }),
    prisma.city.findMany({ select: { slug: true } }),
  ]);

  // Greedy match: el service más largo gana (evita colisión entre "reparacion-lavadoras"
  // y un hipotético "reparacion-lavadoras-industriales")
  const serviceSlug = services
    .map((s) => s.slug)
    .sort((a, b) => b.length - a.length)
    .find((s) => slug === s || slug.startsWith(s + "-"));
  if (!serviceSlug) return null;

  let tail = slug.slice(serviceSlug.length);
  if (tail.startsWith("-")) tail = tail.slice(1);

  let brandSlug: string | null = null;
  let citySlug: string | null = null;

  if (tail) {
    const brandMatch = brands
      .map((b) => b.slug)
      .sort((a, b) => b.length - a.length)
      .find((s) => tail === s || tail.startsWith(s + "-"));
    if (brandMatch) {
      brandSlug = brandMatch;
      tail = tail.slice(brandMatch.length);
      if (tail.startsWith("-")) tail = tail.slice(1);
    }
    if (tail) {
      const cityMatch = cities
        .map((c) => c.slug)
        .sort((a, b) => b.length - a.length)
        .find((s) => tail === s);
      if (cityMatch) citySlug = cityMatch;
      else return null; // tail no reconocido
    }
  }

  return { serviceSlug, brandSlug, citySlug };
}

export async function generateStaticParams(): Promise<Params[]> {
  const [services, brands, cities] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      include: { brands: { include: { brand: true } } },
    }),
    prisma.brand.findMany({ where: { active: true } }),
    prisma.city.findMany({ where: { active: true } }),
  ]);

  const params: Params[] = [];
  for (const sv of services) {
    // Variante 1: solo servicio (catálogo amplio)
    params.push({ slug: sv.slug });
    // Variante 2: servicio + ciudad
    for (const city of cities) {
      params.push({ slug: `${sv.slug}-${city.slug}` });
    }
    // Variante 3: servicio + marca + ciudad (la más SEO-friendly long tail)
    if (sv.requiresBrand) {
      for (const sb of sv.brands) {
        for (const city of cities) {
          params.push({ slug: `${sv.slug}-${sb.brand.slug}-${city.slug}` });
        }
      }
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = await parseSlug(slug);
  if (!parsed) return { title: "Página no encontrada" };

  const [service, brand, city] = await Promise.all([
    prisma.service.findUnique({ where: { slug: parsed.serviceSlug } }),
    parsed.brandSlug ? prisma.brand.findUnique({ where: { slug: parsed.brandSlug } }) : null,
    parsed.citySlug ? prisma.city.findUnique({ where: { slug: parsed.citySlug } }) : null,
  ]);
  if (!service) return { title: "Servicio no encontrado" };

  // Si hay ServiceContent para esta tupla, usa su title/description optimizado
  const content = city
    ? await findServiceContent(prisma, {
        serviceId: service.id,
        brandId: brand?.id ?? null,
        cityId: city.id,
      })
    : null;

  const titleParts = [service.name];
  if (brand) titleParts.push(brand.name);
  if (city) titleParts.push(`en ${city.name}`);
  const defaultTitle = `${titleParts.join(" ")} | Técnicos verificados`;
  const defaultDescription = `Técnico especializado en ${service.name}${
    brand ? ` ${brand.name}` : ""
  }${city ? ` en ${city.name}` : ""}. Servicio el mismo día, garantía y precio justo.`;

  const title = content?.metaTitle ?? content?.h1 ?? defaultTitle;
  const description = content?.metaDescription ?? defaultDescription;

  return {
    title,
    description,
    alternates: { canonical: `/${slug}` },
    openGraph: { title, description, locale: "es_MX", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ServiceLandingPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const parsed = await parseSlug(slug);
  if (!parsed) notFound();

  const [service, brand, city, allCities, brandsForService, serviceCards] = await Promise.all([
    prisma.service.findUnique({
      where: { slug: parsed.serviceSlug },
      include: { category: true },
    }),
    parsed.brandSlug ? prisma.brand.findUnique({ where: { slug: parsed.brandSlug } }) : null,
    parsed.citySlug
      ? prisma.city.findUnique({
          where: { slug: parsed.citySlug },
          include: { zones: true, state: true },
        })
      : null,
    prisma.city.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.serviceBrand.findMany({
      where: { service: { slug: parsed.serviceSlug } },
      include: { brand: true },
    }),
    // Otros servicios de la MISMA categoría — para el selector visual de aparatos
    prisma.service.findMany({
      where: {
        active: true,
        category: { services: { some: { slug: parsed.serviceSlug } } },
      },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!service) notFound();

  // Contenido único IA-generado para esta tupla (service × brand × city)
  const content = city
    ? await findServiceContent(prisma, {
        serviceId: service.id,
        brandId: brand?.id ?? null,
        cityId: city.id,
      })
    : null;

  const defaultH1Parts = [service.name];
  if (brand) defaultH1Parts.push(brand.name);
  if (city) defaultH1Parts.push(`en ${city.name}`);
  const h1Text = content?.h1 ?? defaultH1Parts.join(" ");
  const bodyText = content?.body ?? null;

  // JSON-LD LocalBusiness — solo si tenemos ciudad con coordenadas
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixhub.mx";
  const jsonLd =
    city && city.latitude != null && city.longitude != null
      ? buildLocalBusinessJsonLd({
          url: `${baseUrl}/${slug}`,
          name: `FixHub — ${service.name}${brand ? ` ${brand.name}` : ""} en ${city.name}`,
          description:
            content?.metaDescription ??
            `Reparación especializada de ${service.name}${brand ? ` ${brand.name}` : ""} a domicilio en ${city.name}.`,
          city,
        })
      : null;

  return (
    <main className="min-h-screen bg-slate-50/60">
      {/* JSON-LD LocalBusiness para Geo-SEO */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2 font-semibold text-zinc-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow-indigo">
              <Wrench className="h-4 w-4" />
            </div>
            FixHub
          </Link>
          <Link
            href="/panel"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-brand-600"
          >
            Soy técnico →
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.12),transparent_50%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-5 md:py-16">
          <div className="md:col-span-3">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <BadgeCheck className="h-3 w-3" />
              {service.category.name}
            </div>
            <h1 className="mb-4 text-4xl font-bold leading-[1.1] tracking-tight text-zinc-900 md:text-5xl">
              {h1Text}
            </h1>

            {bodyText ? (
              // Texto único IA-generado del ServiceContent
              <p className="mb-8 text-base leading-relaxed text-zinc-700">{bodyText}</p>
            ) : (
              <p className="mb-8 text-lg leading-relaxed text-zinc-600">
                Solicita un técnico verificado. Te contactamos en minutos con un
                especialista cerca de ti.
              </p>
            )}

            <ul className="space-y-3">
              {[
                { icon: ShieldCheck, text: "Técnicos verificados con experiencia comprobada" },
                { icon: Clock, text: "Servicio el mismo día (sujeto a disponibilidad)" },
                { icon: BadgeCheck, text: "Diagnóstico transparente antes de cobrar" },
                { icon: MapPin, text: "Cobertura en toda la zona metropolitana" },
              ].map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-start gap-3 text-zinc-700">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-money-500/10 text-money-600">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span>{text}</span>
                </li>
              ))}
            </ul>

            {/* Zonas atendidas — útil para SEO local + transparencia */}
            {city && city.zones.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  <MapPin className="h-3.5 w-3.5" />
                  Zonas atendidas en {city.name}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {city.zones.map((z) => (
                    <span
                      key={z.id}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-zinc-700"
                    >
                      {z.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-bento">
              <h2 className="mb-1 text-lg font-bold tracking-tight text-zinc-900">
                Solicita tu técnico
              </h2>
              <p className="mb-5 text-sm text-zinc-500">Toma menos de 1 minuto.</p>
              <LeadForm
                serviceSlug={service.slug}
                requiresBrand={service.requiresBrand}
                serviceCards={serviceCards}
                availableBrands={brandsForService.map((sb) => ({
                  slug: sb.brand.slug,
                  name: sb.brand.name,
                }))}
                presetBrandSlug={brand?.slug}
                cities={allCities.map((c) => ({ slug: c.slug, name: c.name }))}
                presetCitySlug={city?.slug}
                zones={city?.zones.map((z) => ({ slug: z.slug, name: z.name })) ?? []}
              />
            </div>
          </div>
        </div>
      </section>

      {/* SEO: links internos para crawling */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-zinc-900">Cobertura del servicio</h2>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 md:grid-cols-4">
          {allCities.map((c) => (
            <Link
              key={c.id}
              href={`/${service.slug}${brand ? `-${brand.slug}` : ""}-${c.slug}`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-zinc-700 transition-all hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
            >
              {service.name} en {c.name}
            </Link>
          ))}
        </div>
      </section>

      {service.requiresBrand && brandsForService.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-12">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-zinc-900">Marcas que reparamos</h2>
          <div className="flex flex-wrap gap-2">
            {brandsForService.map((sb) => (
              <Link
                key={sb.brand.slug}
                href={`/${service.slug}-${sb.brand.slug}${city ? `-${city.slug}` : ""}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-zinc-700 transition-all hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
              >
                {sb.brand.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
