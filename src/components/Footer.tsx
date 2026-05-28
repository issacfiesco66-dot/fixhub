import Link from "next/link";
import { Wrench, Mail, ShieldCheck } from "lucide-react";

const sections = [
  {
    title: "Servicios",
    links: [
      { href: "/reparacion-lavadoras", label: "Reparación de Lavadoras" },
      { href: "/reparacion-refrigeradores", label: "Reparación de Refrigeradores" },
      { href: "/cerrajeria", label: "Cerrajería 24/7" },
      { href: "/climatizacion", label: "Climatización" },
      { href: "/fumigacion-control-plagas", label: "Fumigación" },
    ],
  },
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

export function Footer() {
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

          {/* Columnas */}
          {sections.map((s) => (
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
