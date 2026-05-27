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
  // Excepción: la página de login no requiere auth — la dejamos pasar.
  // Como este layout cubre /admin/*, hacemos check aquí pero la página de
  // login está en /admin/login y se renderiza a través de este mismo layout,
  // así que en realidad la verificación la hace cada page con redirect cuando
  // no hay admin. Para mantener simple, el layout solo aplica chrome cuando
  // hay sesión; si no, renderiza children "limpio".
  const admin = await getCurrentAdmin();

  if (!admin) {
    // children = login page o redirect
    return <div className="dark min-h-screen bg-zinc-950 text-zinc-100">{children}</div>;
  }

  return (
    <div className="dark flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-zinc-800/80 bg-zinc-950/80 p-4 backdrop-blur md:flex md:flex-col">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-indigo">
            <Wrench className="h-4 w-4 text-white" />
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
              className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              <Icon className="h-4 w-4 text-zinc-500 group-hover:text-brand-400" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 border-t border-zinc-800/80 pt-4">
          <div className="mb-3 px-3 text-xs text-zinc-500">
            <div className="text-zinc-300">{admin.name ?? admin.email}</div>
            <div className="truncate text-[10px]">{admin.email}</div>
          </div>
          <form action="/api/auth/admin-logout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.1),transparent_60%)]" />
        {children}
      </main>
    </div>
  );
}

// Wrapper helper: páginas individuales lo usan para redirigir si no hay admin
export async function requireAdminOrRedirect() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
