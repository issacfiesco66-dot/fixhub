import { Users, Phone, Mail, Wallet, BadgeCheck, MapPin, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMXN } from "@/lib/utils";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";
import { requireAdminOrRedirect } from "../layout";

export const dynamic = "force-dynamic";

export default async function AdminTechniciansPage() {
  await requireAdminOrRedirect();

  const technicians = await prisma.technician.findMany({
    include: {
      user: true,
      coverages: { include: { city: true } },
      services: { include: { service: true } },
      _count: { select: { purchases: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-zinc-900">
          <Users className="h-7 w-7 text-indigo-600" />
          Técnicos
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Registro y verificación de profesionales.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {technicians.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin técnicos registrados.</p>
        ) : (
          technicians.map((t) => (
            <BentoCard key={t.id} className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <BentoIcon tone={t.verified ? "emerald" : "amber"}>
                    {t.verified ? <BadgeCheck className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
                  </BentoIcon>
                  <div>
                    <div className="font-semibold text-zinc-900">{t.displayName}</div>
                    <div className="text-xs text-zinc-500">{t.user.name ?? "Sin nombre legal"}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Saldo</div>
                  <div className="text-lg font-bold tabular-nums text-emerald-700">{formatMXN(t.balance)}</div>
                </div>
              </div>

              <div className="mb-3 space-y-1 text-xs text-zinc-500">
                <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{t.user.email}</div>
                {t.user.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{t.user.phone}</div>}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-200/80 pt-3">
                <Pill icon={<Wallet className="h-3 w-3" />} label={`${t._count.purchases} compras`} />
                <Pill icon={<MapPin className="h-3 w-3" />} label={`${t.coverages.length} ciudades`} />
                <Pill icon={<Wrench className="h-3 w-3" />} label={`${t.services.length} servicios`} />
                {t.verified
                  ? <Pill icon={<BadgeCheck className="h-3 w-3" />} label="Verificado" tone="emerald" />
                  : <Pill icon={<BadgeCheck className="h-3 w-3" />} label="Pendiente" tone="amber" />}
              </div>
            </BentoCard>
          ))
        )}
      </div>
    </div>
  );
}

function Pill({ icon, label, tone = "zinc" }: { icon: React.ReactNode; label: string; tone?: "zinc" | "emerald" | "amber" }) {
  const cls = {
    zinc: "border-slate-200 bg-white text-zinc-600",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${cls}`}>
      {icon}
      {label}
    </span>
  );
}
