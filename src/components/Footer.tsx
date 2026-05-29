import Link from "next/link";
import { Wrench, Mail, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";

const staticSections = [
  {
    title: "Para técnicos",
    links: [
      { href: "/panel/registro", label: "Únete a la red" },
      { href: "/panel/login", label: "Iniciar sesión" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "/terminos", label: "Términos de uso" },
      { href: "/privacidad", label: "Aviso de privacidad" },
      { href: "/cookies", label: "Política de cookies" },
    ],
  },
];

// Fallback estático si la BD no está disponible (p. ej. build sin DATABASE_URL).
const FALLBACK_SERVICES = [
  { slug: "reparacion-lavadoras", name: "Reparación de Lavadoras" },
  { slug: "reparacion-refrigeradores", name: "Reparación de Refrigeradores" },
  { slug: "cerrajeria", name: "Cerrajería 24/7" },
  { slug: "climatizacion", name: "Climatización" },
  { slug: "fumigacion-control-plagas", name: "Fumigación" },
];

// Footer = server component async. Lista TODOS los servicios activos para dar a
// cada landing de servicio un enlace interno presente en todo el sitio. Antes
// solo enlazaba 5 servicios → el audit detectó 121 páginas huérfanas (≤1 link).
export async function Footer() {
  let services: { slug: string; name: string }[];
  try {
    services = await prisma.service.findMany({
      where: { active: true },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    });
    if (services.length === 0) services = FALLBACK_SERVICES;
  } catch {
    services = FALLBACK_SERVICES;
  }

  return (
    <footer className="mt-16 border-t border-slate-200/70 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-16">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Marca + descripción */}
          <div className="md:col-span-1">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/30">
                <Wrench className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-zinc-900">FixHub</span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-600">
              Marketplace mexicano de servicios técnicos a domicilio. Conectamos
              clientes con profesionales verificados en minutos.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50/60 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              <ShieldCheck className="h-3 w-3" />
              Técnicos verificados
            </div>
          </div>

          {/* Servicios destacados */}
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
              Servicios
            </h3>
            <ul className="space-y-2">
              {services.slice(0, 6).map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/${s.slug}`}
                    className="text-sm text-zinc-600 transition-colors hover:text-indigo-700"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Columnas estáticas */}
          {staticSections.map((s) => (
            <div key={s.title}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                {s.title}
              </h3>
              <ul className="space-y-2">
                {s.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-zinc-600 transition-colors hover:text-indigo-700"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Todos los servicios — enlace interno en todo el sitio para que ninguna
            landing de servicio quede huérfana (resuelve el hallazgo de orphan pages). */}
        {services.length > 6 && (
          <nav className="mt-10 border-t border-slate-200/70 pt-6" aria-label="Todos los servicios">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
              Todos nuestros servicios
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {services.map((s) => (
                <Link
                  key={s.slug}
                  href={`/${s.slug}`}
                  className="text-sm text-zinc-500 transition-colors hover:text-indigo-700"
                >
                  {s.name}
                </Link>
              ))}
            </div>
          </nav>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-6 text-xs text-zinc-500">
          <div>© {new Date().getFullYear()} FixHub. Hecho en México.</div>
          <a href="mailto:hola@fixhub.mx" className="inline-flex items-center gap-1 hover:text-indigo-700">
            <Mail className="h-3 w-3" />
            hola@fixhub.mx
          </a>
        </div>
      </div>
    </footer>
  );
}
