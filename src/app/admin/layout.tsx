import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Target,
  Users,
  Briefcase,
  Package,
  Globe,
  LogOut,
  Wrench,
} from "lucide-react";
import { getCurrentAdmin } from "@/lib/auth";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/prospects", label: "Prospects", icon: Target },
  { href: "/admin/leads", label: "Leads", icon: Briefcase },
  { href: "/admin/technicians", label: "Técnicos", icon: Users },
  { href: "/admin/seo", label: "SEO Geo", icon: Globe },
  { href: "/admin/packages", label: "Paquetes", icon: Package },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // El layout muestra chrome solo cuando hay sesión. Si no, deja pasar children
  // (la página de /admin/login no requiere auth).
  const admin = await getCurrentAdmin();

  if (!admin) {
    return (
      <div className="relative min-h-screen bg-slate-50/40 text-zinc-900">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_55%)]"
        />
        {children}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen bg-slate-50/40 text-zinc-900">
      {/* Patrón de puntos + glow ambiental (mismo que la home) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_55%)]"
      />

      {/* Sidebar light glass */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200/70 bg-white/70 p-5 backdrop-blur-md md:flex md:flex-col">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/30">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">FixHub</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Admin</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Icon className="h-4 w-4 text-zinc-400 group-hover:text-indigo-600" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 border-t border-slate-200/70 pt-4">
          <div className="mb-3 px-3 text-xs">
            <div className="text-zinc-700">{admin.name ?? admin.email}</div>
            <div className="truncate text-[10px] text-zinc-500">{admin.email}</div>
          </div>
          <form action="/api/auth/admin-logout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-zinc-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}

// Wrapper helper: páginas individuales lo usan para redirigir si no hay admin
export async function requireAdminOrRedirect() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
