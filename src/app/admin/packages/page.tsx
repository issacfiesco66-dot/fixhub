import { Package, Star, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMXN } from "@/lib/utils";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";
import { requireAdminOrRedirect } from "../layout";

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage() {
  await requireAdminOrRedirect();

  const packages = await prisma.rechargePackage.findMany({ orderBy: { order: "asc" } });

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Package className="h-7 w-7 text-brand-400" />
          Paquetes de recarga
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configuración de pricing para los técnicos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {packages.map((p) => {
          const total = p.amount + p.bonus;
          return (
            <BentoCard key={p.id} className="relative overflow-hidden p-5">
              {p.popular && (
                <div className="absolute -right-8 top-3 rotate-45 bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-md">
                  Popular
                </div>
              )}
              <div className="mb-4">
                <BentoIcon tone="emerald">
                  <Package className="h-5 w-5" />
                </BentoIcon>
              </div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {p.name}
              </div>
              <div className="mb-2 text-3xl font-bold tabular-nums text-zinc-100">
                {formatMXN(p.amount)}
              </div>
              {p.bonus > 0 && (
                <div className="mb-3 flex items-center gap-1 text-sm text-money-400">
                  <Sparkles className="h-3 w-3" /> +{formatMXN(p.bonus)} bono
                </div>
              )}
              <div className="mt-4 space-y-1 border-t border-zinc-800/60 pt-3 text-xs text-zinc-500">
                <Row label="Total créditos" value={formatMXN(total)} />
                <Row label="Leads aprox." value={`${Math.floor(total / 450)}`} />
                <Row label="ROI técnico" value={`${Math.round((p.bonus / p.amount) * 100)}%`} />
                <Row label="Estado" value={p.active ? "Activo" : "Inactivo"} />
              </div>
            </BentoCard>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-zinc-500">
        💡 Para editar paquetes, modifica los registros en{" "}
        <code className="rounded bg-zinc-800/60 px-1.5 py-0.5">RechargePackage</code> en la BD —
        próximamente CRUD aquí.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-medium text-zinc-300 tabular-nums">{value}</span>
    </div>
  );
}
