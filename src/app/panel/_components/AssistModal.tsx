"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  X,
  Sparkles,
  Wrench,
  Hammer,
  ClipboardCheck,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Package,
} from "lucide-react";
import type { WorkType, TechAssist } from "@/lib/ai-diagnosis";

const WORK_TYPES: { value: WorkType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "reparacion", label: "Reparación", icon: Wrench },
  { value: "instalacion", label: "Instalación", icon: Hammer },
  { value: "mantenimiento", label: "Mantenimiento", icon: ClipboardCheck },
];

export function AssistModal({ onClose }: { onClose: () => void }) {
  const [workType, setWorkType] = useState<WorkType>("reparacion");
  const [equipment, setEquipment] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TechAssist | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (equipment.trim().length < 2 || description.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workType, equipment, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo generar");
      setResult(data.result as TechAssist);
      setRemaining(typeof data.remaining === "number" ? data.remaining : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setDescription("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-start gap-3 pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">Asistente IA</h2>
            <p className="text-xs text-zinc-500">
              Consulta cualquier equipo para reparación, instalación o mantenimiento.
            </p>
          </div>
        </div>

        {/* Formulario */}
        {!result && (
          <form onSubmit={submit} className="space-y-4">
            {/* Tipo de trabajo */}
            <div>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Tipo de trabajo
              </span>
              <div className="grid grid-cols-3 gap-2">
                {WORK_TYPES.map(({ value, label, icon: Icon }) => {
                  const active = workType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setWorkType(value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-all ${
                        active
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-zinc-500 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Equipo / marca / modelo
              </span>
              <input
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="Ej. Minisplit Mirage 1.5 ton, Lavadora Whirlpool carga superior…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {workType === "reparacion"
                  ? "¿Qué falla presenta?"
                  : workType === "instalacion"
                  ? "Contexto de la instalación"
                  : "¿Qué mantenimiento necesita?"}
              </span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  workType === "reparacion"
                    ? "Ej. enciende pero no enfría, hace ruido al arrancar…"
                    : workType === "instalacion"
                    ? "Ej. instalación nueva en muro de tablaroca, distancia a toma de 3m…"
                    : "Ej. mantenimiento preventivo de temporada, no se limpia hace 1 año…"
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
                required
              />
            </label>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Generando…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Consultar al asistente
                </>
              )}
            </button>
          </form>
        )}

        {/* Resultado */}
        {result && (
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-zinc-700">{result.summary}</p>

            <div className="space-y-3">
              {result.items.map((it, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-[11px] font-bold text-indigo-600">
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold text-zinc-900">{it.title}</span>
                    </div>
                    {it.tag && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                        {it.tag}
                      </span>
                    )}
                  </div>
                  <p className="pl-7 text-xs text-zinc-600">{it.detail}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {result.materials.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                    <Package className="h-3.5 w-3.5 text-indigo-600" /> Materiales / herramientas
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {result.materials.map((m, i) => (
                      <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-zinc-600">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                  <Clock className="h-3.5 w-3.5 text-indigo-600" /> Tiempo estimado
                </div>
                <span className="text-sm text-zinc-600">{result.estimatedTime}</span>
              </div>
            </div>

            {result.safety.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <ShieldAlert className="h-4 w-4" /> Seguridad
                </div>
                <ul className="space-y-1">
                  {result.safety.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-amber-800/90">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <p className="text-[10px] leading-tight text-zinc-400">
                Sugerencias de IA. Usa tu criterio profesional.
                {remaining !== null && <> · Te quedan {remaining} consultas hoy.</>}
              </p>
              <button
                onClick={reset}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-3 w-3" />
                Nueva consulta
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
