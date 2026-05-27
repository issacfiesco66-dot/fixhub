import { Briefcase, Phone, MapPin, Clock, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMXN } from "@/lib/utils";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";
import { requireAdminOrRedirect } from "../layout";

export const dynamic = "force-dynamic";

const statusMeta: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-400" },
  PURCHASED: { label: "Vendido", cls: "bg-money-500/15 text-money-400" },
  EXPIRED: { label: "Expirado", cls: "bg-zinc-700/40 text-zinc-400" },
  CANCELLED: { label: "Cancelado", cls: "bg-red-500/15 text-red-400" },
};

export default async function AdminLeadsPage() {
  await requireAdminOrRedirect();

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      service: true,
      brand: true,
      city: true,
      zone: true,
      purchase: { include: { technician: { include: { user: true } } } },
    },
  });

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Briefcase className="h-7 w-7 text-brand-400" />
          Leads
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Todos los pedidos enviados por los clientes en la plataforma.
        </p>
      </div>

      <BentoCard className="overflow-hidden">
        <div className="divide-y divide-zinc-800/60">
          {leads.length === 0 ? (
            <p className="p-10 text-center text-sm text-zinc-500">Aún no hay leads.</p>
          ) : (
            leads.map((l) => {
              const meta = statusMeta[l.status];
              return (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-zinc-900/30">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <BentoIcon tone="indigo">
                      <Briefcase className="h-4 w-4" />
                    </BentoIcon>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-zinc-100">
                          {l.service.name}
                          {l.brand && <span className="text-zinc-400"> · {l.brand.name}</span>}
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {l.clientName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {l.clientPhone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {l.city.name}
                          {l.zone && `, ${l.zone.name}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(l.createdAt).toLocaleString("es-MX", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs italic text-zinc-500">"{l.failure}"</p>
                      {l.purchase && (
                        <div className="mt-1.5 text-[11px] text-money-400">
                          → Comprado por <strong>{l.purchase.technician.displayName}</strong> ({formatMXN(l.purchase.pricePaid)})
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className={`text-sm font-semibold ${l.status === "PURCHASED" ? "text-money-400" : "text-zinc-300"}`}>
                      {formatMXN(l.price)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </BentoCard>
    </div>
  );
}
