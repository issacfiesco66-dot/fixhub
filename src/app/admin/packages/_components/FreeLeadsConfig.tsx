"use client";

import { useState } from "react";
import { Gift, Check } from "lucide-react";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";

export function FreeLeadsConfig({ initial }: { initial: number }) {
  const [value, setValue] = useState(String(initial));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = parseInt(value, 10) !== initial && value.trim() !== "";

  async function save() {
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n < 0) {
      setError("Número inválido");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeLeadsLimit: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BentoCard className="mb-8 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <BentoIcon tone="emerald">
            <Gift className="h-5 w-5" />
          </BentoIcon>
          <div>
            <div className="text-sm font-semibold text-zinc-900">Servicios gratis por técnico</div>
            <p className="text-xs text-zinc-500">
              Cuántos leads de cortesía recibe cada técnico nuevo antes de empezar a pagar
              (de por vida).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold tabular-nums text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
          />
          <button
            onClick={save}
            disabled={busy || !dirty}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg disabled:opacity-40"
          >
            {saved ? <Check className="h-4 w-4" /> : null}
            {busy ? "Guardando…" : saved ? "Guardado" : "Guardar"}
          </button>
        </div>
      </div>
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </BentoCard>
  );
}
