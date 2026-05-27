"use client";

import { useState } from "react";
import { MapPin, Clock, Zap, AlertTriangle } from "lucide-react";
import { formatMXN } from "@/lib/utils";
import { BentoCard } from "@/components/ui/BentoCard";

type Lead = {
  id: string;
  failure: string;
  urgency: "NORMAL" | "URGENT" | "EMERGENCY";
  price: number;
  createdAt: string;
  expiresAt: string;
  addressHint: string | null;
  service: { name: string };
  brand: { name: string } | null;
  city: { name: string };
  zone: { name: string } | null;
};

const urgencyMeta = {
  EMERGENCY: {
    label: "Emergencia",
    icon: AlertTriangle,
    cls: "bg-red-500/15 text-red-400 ring-red-500/30",
    accent: "from-red-500 to-rose-600",
  },
  URGENT: {
    label: "Urgente",
    icon: Zap,
    cls: "bg-amber-500/10 text-amber-700 ring-amber-500/30",
    accent: "from-amber-500 to-orange-500",
  },
  NORMAL: {
    label: "Normal",
    icon: Zap,
    cls: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20",
    accent: "from-indigo-500 to-indigo-600",
  },
} as const;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Hace segundos";
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `Hace ${hrs}h`;
}

export function LeadCard({ lead, onPurchase }: { lead: Lead; onPurchase: () => void }) {
  const [busy, setBusy] = useState(false);
  const u = urgencyMeta[lead.urgency];
  const UrgencyIcon = u.icon;

  async function handle() {
    setBusy(true);
    try {
      await onPurchase();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BentoCard hover className="overflow-hidden p-5">
      {/* Accent line */}
      <div className={`-mx-5 -mt-5 mb-4 h-1 bg-gradient-to-r ${u.accent}`} />

      <div className="mb-3 flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${u.cls}`}
        >
          <UrgencyIcon className="h-3 w-3" />
          {u.label}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
          <Clock className="h-3 w-3" />
          {timeAgo(lead.createdAt)}
        </span>
      </div>

      <h3 className="text-base font-semibold text-zinc-900">
        {lead.service.name}
        {lead.brand && (
          <span className="text-indigo-600"> · {lead.brand.name}</span>
        )}
      </h3>

      <div className="mb-3 mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
        <MapPin className="h-3 w-3" />
        <span>
          {lead.zone ? `${lead.zone.name}, ` : ""}
          {lead.city.name}
          {lead.addressHint && ` · ${lead.addressHint}`}
        </span>
      </div>

      <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-zinc-500">{lead.failure}</p>

      <button
        onClick={handle}
        disabled={busy}
        className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50"
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <span className="relative inline-flex items-center justify-center gap-1.5">
          <Zap className="h-3.5 w-3.5" />
          {busy ? "Procesando..." : `Atender por ${formatMXN(lead.price)}`}
        </span>
      </button>
    </BentoCard>
  );
}
