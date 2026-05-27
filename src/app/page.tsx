import Link from "next/link";
import {
  Wrench,
  WashingMachine,
  Zap,
  Droplets,
  ShieldCheck,
  Clock,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "linea-blanca": WashingMachine,
  "plomeria": Droplets,
  "electricidad": Zap,
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
    <main className="min-h-screen bg-slate-50/60">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2 font-semibold text-zinc-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow-indigo">
              <Wrench className="h-4 w-4" />
            </div>
            FixHub
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/panel"
              className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              Soy Técnico
            </Link>
            <Link
              href="#servicios"
              className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:shadow-glow-indigo"
            >
              Solicitar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_55%)]" />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-money-300/60 bg-money-50 px-3 py-1 text-xs font-medium text-money-700">
            <ShieldCheck className="h-3 w-3" />
            Técnicos verificados
          </div>
          <h1 className="mb-5 text-5xl font-bold leading-[1.05] tracking-tight text-zinc-900 md:text-6xl">
            Reparaciones a domicilio,{" "}
            <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
              en minutos
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-zinc-600">
            Electrodomésticos, plomería, electricidad y más. El mismo día, en tu zona,
            con garantía.
          </p>
          <Link
            href="#servicios"
            className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-brand-500/30 transition-all hover:shadow-glow-indigo"
          >
            Solicitar técnico ahora
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-money-600" />
              Respuesta en &lt;5 min
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-money-600" />
              Garantía 30 días
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-money-600" />
              {cities.length}+ ciudades
            </span>
          </div>
        </div>
      </section>

      {/* Servicios por categoría */}
      <section id="servicios" className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Nuestros servicios</h2>
          <p className="mt-1 text-zinc-500">Selecciona la categoría que necesitas</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.slug] ?? Wrench;
            return (
              <div
                key={cat.id}
                className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-bento transition-all hover:border-brand-300 hover:shadow-glow-indigo"
              >
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-brand-500/5 to-transparent" />
                <div className="relative">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 ring-1 ring-brand-500/20">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-1 text-xl font-bold text-zinc-900">{cat.name}</h3>
                  {cat.description && (
                    <p className="mb-4 text-sm text-zinc-500">{cat.description}</p>
                  )}
                  <ul className="space-y-2">
                    {cat.services.map((sv) => (
                      <li key={sv.id}>
                        <Link
                          href={`/${sv.slug}`}
                          className="group/link flex items-center justify-between rounded-xl px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
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

      {/* Ciudades */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-zinc-900">Cobertura</h2>
        <div className="flex flex-wrap gap-2">
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

      <footer className="mt-12 border-t border-slate-200/70 bg-white/60 py-8 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} FixHub. Hecho en México.
      </footer>
    </main>
  );
}
