import Link from "next/link";
import {
  Briefcase,
  Users,
  Target,
  TrendingUp,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMXN } from "@/lib/utils";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";
import { requireAdminOrRedirect } from "./layout";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdminOrRedirect();

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalLeads,
    pendingLeads,
    purchasedLeads,
    leads30d,
    totalTechs,
    verifiedTechs,
    revenueAgg,
    prospectGrouped,
    latestLeads,
    latestProspects,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: "PENDING" } }),
    prisma.lead.count({ where: { status: "PURCHASED" } }),
    prisma.lead.count({ where: { createdAt: { gte: since30d } } }),
    prisma.technician.count(),
    prisma.technician.count({ where: { verified: true } }),
    prisma.balanceTransaction.aggregate({
      where: { type: "RECHARGE", status: "COMPLETED", createdAt: { gte: since30d } },
      _sum: { amount: true },
    }),
    prisma.prospect.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { service: true, city: true, brand: true },
    }),
    prisma.prospect.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const prospectStats: Record<string, number> = { NEW: 0, CONTACTED: 0, CONVERTED: 0, DISCARDED: 0 };
  for (const p of prospectGrouped) prospectStats[p.status] = p._count.status;

  const conversionRate = totalLeads ? Math.round((purchasedLeads / totalLeads) * 100) : 0;

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">Vista general de la plataforma — últimos 30 días</p>
      </div>

      {/* Bento Grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          tone="emerald"
          icon={<Wallet className="h-5 w-5" />}
          label="Ingresos 30d"
          value={formatMXN(revenueAgg._sum.amount ?? 0)}
          hint="recargas confirmadas"
          big
        />
        <StatCard
          tone="indigo"
          icon={<Briefcase className="h-5 w-5" />}
          label="Leads totales"
          value={String(totalLeads)}
          hint={`+${leads30d} en 30d`}
        />
        <StatCard
          tone="amber"
          icon={<TrendingUp className="h-5 w-5" />}
          label="Conversión"
          value={`${conversionRate}%`}
          hint={`${purchasedLeads} comprados`}
        />
        <StatCard
          tone="indigo"
          icon={<Users className="h-5 w-5" />}
          label="Técnicos"
          value={`${verifiedTechs}/${totalTechs}`}
          hint="verificados / total"
        />
      </div>

      {/* Pipeline de prospects + leads pendientes */}
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <BentoCard className="p-5 lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BentoIcon tone="indigo">
                <Target className="h-4 w-4" />
              </BentoIcon>
              <div>
                <div className="text-sm font-semibold">Pipeline de Prospects</div>
                <div className="text-[11px] text-zinc-500">Outbound</div>
              </div>
            </div>
            <Link
              href="/admin/prospects"
              className="text-xs font-medium text-brand-400 hover:text-brand-300"
            >
              Ver todos →
            </Link>
          </div>
          <div className="space-y-2">
            <PipelineRow label="Nuevos" value={prospectStats.NEW} tone="indigo" />
            <PipelineRow label="Contactados" value={prospectStats.CONTACTED} tone="amber" />
            <PipelineRow label="Convertidos" value={prospectStats.CONVERTED} tone="emerald" />
            <PipelineRow label="Descartados" value={prospectStats.DISCARDED} tone="zinc" />
          </div>
        </BentoCard>

        <BentoCard className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BentoIcon tone="amber">
                <Clock className="h-4 w-4" />
              </BentoIcon>
              <div>
                <div className="text-sm font-semibold">Leads activos en marketplace</div>
                <div className="text-[11px] text-zinc-500">{pendingLeads} disponibles para técnicos</div>
              </div>
            </div>
            <Link href="/admin/leads" className="text-xs font-medium text-brand-400 hover:text-brand-300">
              Gestionar →
            </Link>
          </div>
          <div className="space-y-2">
            {latestLeads.length === 0 ? (
              <p className="text-sm text-zinc-500">Aún no hay leads.</p>
            ) : (
              latestLeads.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium text-zinc-100">
                      {l.service.name}
                      {l.brand && <span className="text-zinc-400"> · {l.brand.name}</span>}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {l.city.name} · {new Date(l.createdAt).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                    </div>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
              ))
            )}
          </div>
        </BentoCard>
      </div>

      {/* Latest prospects + quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <BentoCard className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BentoIcon tone="emerald">
                <Target className="h-4 w-4" />
              </BentoIcon>
              <div className="text-sm font-semibold">Prospects recientes</div>
            </div>
            <Link href="/admin/prospects" className="text-xs font-medium text-brand-400 hover:text-brand-300">
              Ver todos →
            </Link>
          </div>
          <div className="space-y-2">
            {latestProspects.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin prospects todavía.</p>
            ) : (
              latestProspects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium text-zinc-100">{p.name}</div>
                    <div className="text-[11px] text-zinc-500">
                      {p.city} · {p.source}
                    </div>
                  </div>
                  <ProspectBadge status={p.status} />
                </div>
              ))
            )}
          </div>
        </BentoCard>

        <BentoCard className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <BentoIcon tone="indigo">
              <ShieldCheck className="h-4 w-4" />
            </BentoIcon>
            <div className="text-sm font-semibold">Acciones rápidas</div>
          </div>
          <div className="space-y-2">
            <QuickLink href="/admin/prospects" label="Importar prospects" icon={<Target className="h-4 w-4" />} />
            <QuickLink href="/admin/technicians" label="Verificar técnicos" icon={<CheckCircle2 className="h-4 w-4" />} />
            <QuickLink href="/admin/packages" label="Editar paquetes" icon={<Wallet className="h-4 w-4" />} />
          </div>
        </BentoCard>
      </div>
    </div>
  );
}

function StatCard({
  tone,
  icon,
  label,
  value,
  hint,
  big = false,
}: {
  tone: "indigo" | "emerald" | "amber";
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  big?: boolean;
}) {
  return (
    <BentoCard className="p-5">
      <div className="mb-4">
        <BentoIcon tone={tone}>{icon}</BentoIcon>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 font-bold tabular-nums text-zinc-100 ${big ? "text-3xl" : "text-2xl"}`}>
        {value}
      </div>
      <div className="text-[11px] text-zinc-500">{hint}</div>
    </BentoCard>
  );
}

function PipelineRow({ label, value, tone }: { label: string; value: number; tone: "indigo" | "amber" | "emerald" | "zinc" }) {
  const cls = {
    indigo: "bg-brand-500/15 text-brand-400",
    amber: "bg-amber-500/15 text-amber-400",
    emerald: "bg-money-500/15 text-money-400",
    zinc: "bg-zinc-700/40 text-zinc-400",
  }[tone];
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3 py-2">
      <span className="text-sm text-zinc-300">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-400" },
    PURCHASED: { label: "Vendido", cls: "bg-money-500/15 text-money-400" },
    EXPIRED: { label: "Expirado", cls: "bg-zinc-700/40 text-zinc-400" },
    CANCELLED: { label: "Cancelado", cls: "bg-red-500/15 text-red-400" },
  };
  const m = map[status] ?? map.PENDING;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${m.cls}`}>
      {m.label}
    </span>
  );
}

function ProspectBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    NEW: { label: "Nuevo", cls: "bg-brand-500/15 text-brand-400" },
    CONTACTED: { label: "Contactado", cls: "bg-amber-500/15 text-amber-400" },
    CONVERTED: { label: "Convertido", cls: "bg-money-500/15 text-money-400" },
    DISCARDED: { label: "Descartado", cls: "bg-zinc-700/40 text-zinc-400" },
  };
  const m = map[status] ?? map.NEW;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${m.cls}`}>
      {m.label}
    </span>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:border-brand-500/40 hover:bg-zinc-900"
    >
      <span className="flex items-center gap-2">
        <span className="text-brand-400">{icon}</span>
        {label}
      </span>
      <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
    </Link>
  );
}
