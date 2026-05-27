"use client";

import { useState } from "react";
import { BadgeCheck, Loader2, Power, PowerOff } from "lucide-react";

type Props = {
  id: string;
  verified: boolean;
  active: boolean;
};

export function VerifyControls({ id, verified, active }: Props) {
  const [v, setV] = useState(verified);
  const [a, setA] = useState(active);
  const [busy, setBusy] = useState(false);

  async function patch(updates: { verified?: boolean; active?: boolean }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/technicians/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Error");
        return;
      }
      if (updates.verified !== undefined) setV(updates.verified);
      if (updates.active !== undefined) setA(updates.active);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        disabled={busy}
        onClick={() => patch({ verified: !v })}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-50 ${
          v
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
        }`}
        title={v ? "Click para des-verificar" : "Click para verificar"}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <BadgeCheck className="h-3 w-3" />}
        {v ? "Verificado" : "Pendiente"}
      </button>
      <button
        disabled={busy}
        onClick={() => patch({ active: !a })}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-50 ${
          a
            ? "border-slate-200 bg-white text-zinc-600 hover:bg-slate-50"
            : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
        }`}
        title={a ? "Click para desactivar" : "Click para activar"}
      >
        {a ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
        {a ? "Activo" : "Inactivo"}
      </button>
    </div>
  );
}
