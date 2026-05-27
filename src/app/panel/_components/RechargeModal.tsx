"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CreditCard,
  Sparkles,
  Check,
  Lock,
  X,
} from "lucide-react";
import { formatMXN } from "@/lib/utils";

type Package = {
  id: string;
  name: string;
  amount: number;
  bonus: number;
  popular: boolean;
};

type Props = {
  packages: Package[];
  balance: number;
  reason: "manual" | "insufficient";
  onClose: () => void;
};

export function RechargeModal({ packages, balance, reason, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string>(
    packages.find((p) => p.popular)?.id ?? packages[0]?.id ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Error al iniciar el pago");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  }

  const insufficient = reason === "insufficient";
  const selected = packages.find((p) => p.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/70 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-white/90 shadow-2xl backdrop-blur-2xl dark:bg-zinc-900/90"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-black/10 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div
          className={`px-6 py-4 ${
            insufficient
              ? "bg-gradient-to-r from-red-500 to-rose-600"
              : "bg-gradient-to-r from-money-500 to-money-700"
          }`}
        >
          <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
            {insufficient ? (
              <>
                <AlertTriangle className="h-4 w-4" />
                Fondos insuficientes
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Recargar saldo
              </>
            )}
          </div>
        </div>

        <div className="p-6">
          {insufficient && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-sm dark:border-red-500/20 dark:bg-red-500/10">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
              <div className="text-red-800 dark:text-red-200">
                Tu saldo actual es{" "}
                <strong className="tabular-nums">{formatMXN(balance)}</strong>. Recarga ahora y
                no pierdas el trabajo — otros técnicos están viendo este lead en este momento.
              </div>
            </div>
          )}

          <p className="mb-5 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Elige el paquete ideal. Mientras más recargas, más bonus de cortesía.
          </p>

          {/* Paquetes */}
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {packages.map((p) => {
              const isSelected = selectedId === p.id;
              const total = p.amount + p.bonus;
              const leadCount = Math.floor(total / 450);
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all ${
                    isSelected
                      ? "border-brand-500 bg-brand-50/60 shadow-glow-indigo dark:bg-brand-500/10"
                      : "border-zinc-200 hover:border-brand-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  {p.popular && (
                    <div className="absolute -right-8 top-3 rotate-45 bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-md">
                      Popular
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                      <Check className="h-3 w-3" />
                    </div>
                  )}

                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {p.name}
                  </div>
                  <div className="mb-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatMXN(p.amount)}
                  </div>
                  {p.bonus > 0 && (
                    <div className="flex items-center gap-1 text-xs font-medium text-money-600 dark:text-money-400">
                      <Sparkles className="h-3 w-3" />+{formatMXN(p.bonus)} bono
                    </div>
                  )}
                  <div className="mt-3 border-t border-zinc-200/80 pt-2 text-xs text-zinc-500 dark:border-zinc-800/80">
                    Recibes{" "}
                    <strong className="text-zinc-700 dark:text-zinc-300">
                      {formatMXN(total)}
                    </strong>
                    <br />
                    ≈ <strong className="text-brand-600 dark:text-brand-400">{leadCount} leads</strong>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Métodos de pago */}
          <div className="mb-5 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-zinc-100/60 px-4 py-2.5 text-xs text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400">
            <Lock className="h-3.5 w-3.5" />
            <span className="font-medium">Pago seguro:</span>
            <span>Tarjeta</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span>OXXO</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="text-zinc-400">por Stripe</span>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={loading || !selectedId}
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-money-500 to-money-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-money-500/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative inline-flex items-center justify-center gap-2">
              <CreditCard className="h-5 w-5" />
              {loading
                ? "Abriendo pago seguro..."
                : selected
                  ? `Pagar ${formatMXN(selected.amount)} ahora`
                  : "Recargar ahora"}
            </span>
          </button>

          <button
            onClick={onClose}
            className="mt-3 w-full text-center text-[11px] uppercase tracking-wider text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
