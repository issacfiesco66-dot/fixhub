import Link from "next/link";
import Image from "next/image";
import {
  Wrench,
  ShieldCheck,
  Clock,
  ArrowRight,
  MapPin,
  Sparkles,
  AlertTriangle,
  Home,
  Truck,
  Heart,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { HeroCTA } from "@/components/HeroCTA";
import { HowItWorks } from "@/components/HowItWorks";
import { TrustBar } from "@/components/TrustBar";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";
import { SiteSearch } from "@/components/SiteSearch";

// Render on-demand. Antes era revalidate=3600 (ISR), pero eso intenta
// pre-renderizar en build y necesita DATABASE_URL desde el primer deploy.
// Con force-dynamic la home se renderiza por request y se cachea vía
// los headers del CDN. Cuando estabilices prod podés revertir a ISR.
export const dynamic = "force-dynamic";

// Icono Lucide por categoría (nueva taxonomía)
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "emergencia": AlertTriangle,
  "reparacion-soporte": Wrench,
  "mantenimiento-hogar": Home,
  "automotriz-logistica": Truck,
  "especializados-prevision": Heart,
};

// Imagen ilustrativa IA por categoría + alt SEO local
const categoryImage: Record<string, { src: string; alt: string }> = {
  "emergencia": {
    src: "/images/cat-emergencia.png",
    alt: "Servicios de emergencia 24/7: cerrajería, plomería y electricistas a domicilio",
  },
  "reparacion-soporte": {
    src: "/images/cat-reparacion-soporte.png",
    alt: "Reparación de línea blanca, refrigeradores y climatización a domicilio",
  },
  "mantenimiento-hogar": {
    src: "/images/cat-mantenimiento-hogar.png",
    alt: "Mantenimiento del hogar: fumigación, limpieza, impermeabilización y pintura",
  },
  "automotriz-logistica": {
    src: "/images/cat-automotriz-logistica.png",
    alt: "Servicios automotrices y logísticos: mecánica a domicilio, grúas y fletes",
  },
  "especializados-prevision": {
    src: "/images/cat-especializados-prevision.png",
    alt: "Servicios especializados: funerarios, previsión y cuidado de mascotas",
  },
};

export default async function HomePage() {
  const [categories, cities] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      include: { services: { where: { active: true } } },
      orderBy: { order: "asc" },
    }),
    prisma.city.findMany({ where: { active: true }, orderBy: { name: "asc" }, take: 12 }),
  ]);

  return (
    <main className="relative min-h-screen bg-white">
      {/* Patrón de puntos — más sutil + solo en desktop (en mobile el bg
          queda blanco limpio, sin la sensación gris densa) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 hidden bg-[radial-gradient(#eef2f6_1px,transparent_1px)] [background-size:18px_18px] md:block"
      />
      {/* Glow ambiental indigo top — más extenso */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[800px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_60%)]"
      />

      {/* Header — full-width, 3 zonas: logo · navegación · CTAs (sin huecos muertos) */}
      <header className="sticky top-0 z-20 w-full border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
        <div className="flex w-full items-center justify-between gap-6 px-4 py-3.5 sm:px-10 lg:px-16">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5 font-semibold text-zinc-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/30">
              <Wrench className="h-5 w-5" />
            </div>
            <span className="text-lg tracking-tight">FixHub</span>
          </Link>

          {/* Navegación central — llena el header en desktop */}
          <nav className="hidden items-center gap-8 lg:flex">
            <Link href="#servicios" className="text-sm font-medium text-zinc-600 transition-colors hover:text-indigo-700">
              Servicios
            </Link>
            <Link href="#como-funciona" className="text-sm font-medium text-zinc-600 transition-colors hover:text-indigo-700">
              Cómo funciona
            </Link>
            <Link href="/para-tecnicos" className="text-sm font-medium text-zinc-600 transition-colors hover:text-indigo-700">
              Para técnicos
            </Link>
          </nav>

          {/* CTAs */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/panel/login"
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-zinc-700 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            >
              Soy Técnico
            </Link>
            <Link
              href="#servicios"
              className="group relative overflow-hidden rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 ring-1 ring-white/10 transition-all hover:shadow-lg hover:shadow-indigo-500/50"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">Solicitar</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — full-width, ancho generoso, alto razonable */}
      <section className="relative">
        <div className="w-full px-4 pt-8 pb-14 sm:px-10 sm:pt-10 sm:pb-20 lg:px-16 lg:pt-16 lg:pb-24">
          <div className="mx-auto max-w-[1600px] overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_20px_80px_-20px_rgba(99,102,241,0.25)] sm:rounded-[2rem] md:border-white/40 md:bg-white/80 md:backdrop-blur-md">
            <div className="grid items-stretch gap-0 lg:grid-cols-5">
              {/* Texto — 3 cols, padding compacto en mobile, generoso en desktop */}
              <div className="flex flex-col justify-center px-6 py-10 sm:px-12 sm:py-16 lg:col-span-3 lg:py-20 lg:pl-16 lg:pr-10">
                <div className="mb-7 inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50/80 px-4 py-1.5 text-xs font-medium text-emerald-700 backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  Técnicos verificados · Servicio el mismo día
                </div>

                <h1 className="mb-6 text-4xl font-bold leading-[1.05] tracking-tight text-balance text-zinc-900 sm:text-5xl md:text-6xl">
                  Reparaciones a domicilio,{" "}
                  <span className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                    en minutos
                  </span>
                </h1>

                <p className="mb-8 max-w-xl text-base leading-relaxed text-zinc-600 md:text-lg">
                  Electrodomésticos, plomería, electricidad y más. El mismo día,
                  en tu zona, con garantía.
                </p>

                {/* Buscador del sitio — captura demanda + autocomplete contra catálogo */}
                <div className="mb-6 max-w-2xl">
                  <SiteSearch cities={cities.map((c) => ({ slug: c.slug, name: c.name }))} />
                </div>

                <HeroCTA />

                <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-zinc-500 md:text-base">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    Respuesta en &lt;5 min
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Garantía 30 días
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    {cities.length}+ ciudades
                  </span>
                </div>
              </div>

              {/* Imagen — 2 cols, altura matchea el contenido */}
              <div className="relative h-72 w-full overflow-hidden sm:h-96 lg:col-span-2 lg:h-auto lg:min-h-[520px]">
                <div className="absolute inset-0 z-10 bg-gradient-to-br from-indigo-500/15 via-transparent to-violet-500/10 mix-blend-overlay" />
                <Image
                  src="/images/hero.png"
                  alt="Técnico profesional FixHub atendiendo a un cliente en casa moderna en México"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar — señales rápidas de confianza */}
      <TrustBar />

      {/* Cómo funciona — 3 pasos */}
      <HowItWorks />

      {/* Servicios por categoría — cards con imagen IA + lista de servicios */}
      <section id="servicios" className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:px-16">
        <div className="mb-10">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Nuestros servicios</h2>
          <p className="mt-1 text-zinc-500">Selecciona la categoría que necesitas</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.slug] ?? Wrench;
            const img = categoryImage[cat.slug];
            return (
              <div
                key={cat.id}
                className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-bento transition-all hover:border-indigo-300 hover:shadow-[0_12px_40px_-10px_rgba(99,102,241,0.35)]"
              >
                {/* Imagen IA en el top */}
                {img && (
                  <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-indigo-50 to-violet-50">
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1 text-xl font-bold text-zinc-900">{cat.name}</h3>
                  {cat.description && (
                    <p className="mb-4 text-sm text-zinc-500">{cat.description}</p>
                  )}
                  <ul className="space-y-1">
                    {cat.services.map((sv) => (
                      <li key={sv.id}>
                        <Link
                          href={`/${sv.slug}`}
                          className="group/link flex items-center justify-between rounded-xl px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          <span>{sv.name}</span>
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover/link:translate-x-0.5 group-hover/link:opacity-100" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <FAQ />

      {/* Ciudades */}
      <section className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-16">
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            Cobertura en {cities.length} ciudades
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Y creciendo cada semana</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {cities.map((c) => (
            <span
              key={c.id}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-zinc-700"
            >
              {c.name}
            </span>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
