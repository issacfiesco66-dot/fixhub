"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, Eye, MapPin, Clock, AlertTriangle, X } from "lucide-react";
import { formatMXN } from "@/lib/utils";

type AlertPayload = {
  leadId: string;
  service: string;
  brand: string | null;
  city: string;
  zone: string | null;
  failure: string;
  urgency: "NORMAL" | "URGENT" | "EMERGENCY";
  price: number;
  viewersHint: number;
  expiresAt: string;
};

type Props = {
  alert: AlertPayload;
  isFree?: boolean;
  onAccept: () => void;
  onClose: () => void;
};

const COUNTDOWN_SECONDS = 60;
const URGENT_THRESHOLD = 15;

export function LeadAlertModal({ alert, isFree = false, onAccept, onClose }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) {
      const t = setTimeout(onClose, 1200);
      return () => clearTimeout(t);
    }
  }, [secondsLeft, onClose]);

  const isUrgent = secondsLeft <= URGENT_THRESHOLD && secondsLeft > 0;
  const isExpired = secondsLeft === 0;
  const progress = (secondsLeft / COUNTDOWN_SECONDS) * 100;

  const urgencyConfig = {
    EMERGENCY: { label: "EMERGENCIA", icon: AlertTriangle, gradient: "from-red-500 via-rose-500 to-red-600" },
    URGENT: { label: "URGENTE", icon: Zap, gradient: "from-amber-500 via-orange-500 to-red-500" },
    NORMAL: { label: "TRABAJO NUEVO", icon: Zap, gradient: "from-indigo-500 via-indigo-500 to-violet-500" },
  } as const;
  const u = urgencyConfig[alert.urgency];
  const UrgencyIcon = u.icon;

  async function handleAccept() {
    setPurchasing(true);
    try {
      await onAccept();
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-50/60 backdrop-blur-md"
      />

      {/* Modal — glassmorphism + opcional shake en últimos 15s */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className={`relative w-full max-w-md overflow-hidden rounded-3xl border border-white/40 bg-white/80 shadow-2xl backdrop-blur-2xl ${
          isUrgent ? "animate-shake" : ""
        }`}
        style={{
          boxShadow: isUrgent
            ? "0 0 60px rgba(220,38,38,0.4), 0 25px 60px rgba(0,0,0,0.6)"
            : "0 25px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-black/10 hover:text-zinc-900"
        >
          <X className="h-4 w-4" />
        </button>

        {/* COUNTDOWN BAR: gradiente que se reduce */}
        <div className="relative h-1.5 w-full overflow-hidden bg-zinc-200/60">
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "linear" }}
            className={`h-full bg-gradient-to-r ${
              isUrgent ? "from-red-500 to-rose-600" : "from-amber-500 to-red-500"
            }`}
          />
          {/* Shimmer overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] bg-[length:200%_100%] animate-shimmer" />
        </div>

        {/* HEADER con badge de urgencia (gradiente) */}
        <div className={`bg-gradient-to-r ${u.gradient} px-6 py-3`}>
          <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
            <UrgencyIcon className="h-4 w-4" />
            {u.label}
          </div>
        </div>

        <div className="p-6">
          {/* Título */}
          <div className="mb-4 text-center">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-widest text-amber-600">
              ⚠️ Nuevo trabajo disponible
            </div>
            <h2 className="text-2xl font-bold leading-tight text-zinc-900">
              {alert.service}
              {alert.brand && (
                <span className="text-indigo-600"> · {alert.brand}</span>
              )}
            </h2>
          </div>

          {/* Ubicación */}
          <div className="mb-4 flex items-center justify-center gap-1.5 text-sm text-zinc-600">
            <MapPin className="h-3.5 w-3.5" />
            <span>
              {alert.zone ? `${alert.zone}, ` : ""}
              {alert.city}
            </span>
          </div>

          {/* Descripción de la falla */}
          <div className="mb-5 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3.5 backdrop-blur">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Detalle de la falla
            </div>
            <p className="text-sm leading-relaxed text-zinc-700">
              {alert.failure}
            </p>
          </div>

          {/* FOMO + Timer */}
          <div
            className={`mb-5 flex items-center justify-between rounded-2xl border px-4 py-2.5 text-sm transition-colors ${
              isUrgent
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-amber-300 bg-amber-500/10 text-amber-700"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Eye className={`h-4 w-4 ${isUrgent ? "animate-pulse" : ""}`} />
              <strong>{alert.viewersHint} técnicos</strong> viendo este lead
            </span>
            <span className="flex items-center gap-1.5 font-mono font-bold tabular-nums">
              <Clock className="h-3.5 w-3.5" />
              <span className={isUrgent ? "animate-pulse text-red-600" : ""}>
                {String(secondsLeft).padStart(2, "0")}s
              </span>
            </span>
          </div>

          {/* CTA principal */}
          <button
            onClick={handleAccept}
            disabled={purchasing || isExpired}
            className={`group relative w-full overflow-hidden rounded-2xl px-6 py-4 text-base font-bold text-white shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 ${
              isUrgent
                ? "bg-gradient-to-r from-red-600 to-rose-700 shadow-red-500/30"
                : "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/40"
            }`}
          >
            {/* Glow shimmer */}
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative inline-flex items-center justify-center gap-2">
              {purchasing ? (
                "Procesando..."
              ) : isExpired ? (
                "Tiempo agotado"
              ) : isFree ? (
                <>
                  <Zap className="h-4 w-4" />
                  Atender GRATIS 🎁
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Atender por {formatMXN(alert.price)}
                </>
              )}
            </span>
          </button>

          <button
            onClick={onClose}
            className="mt-3 w-full text-center text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-600"
          >
            Ignorar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
