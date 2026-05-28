"use client";

import { motion } from "framer-motion";
import {
  X,
  Sparkles,
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import type { RepairDiagnosis, DiagnosisCause } from "@/lib/ai-diagnosis";

type Props = {
  serviceName: string;
  brandName: string | null;
  problem: string;
  diagnosis: RepairDiagnosis | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  onRegenerate: () => void;
  onClose: () => void;
};

const likelihoodMeta: Record<DiagnosisCause["likelihood"], { label: string; cls: string }> = {
  alta: { label: "Probable", cls: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20" },
  media: { label: "Posible", cls: "bg-amber-500/10 text-amber-700 ring-amber-500/30" },
  baja: { label: "Menos común", cls: "bg-zinc-100 text-zinc-500 ring-zinc-200" },
};

export function DiagnosisModal({
  serviceName,
  brandName,
  problem,
  diagnosis,
  loading,
  error,
  onGenerate,
  onRegenerate,
  onClose,
}: Props) {
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

        {/* Header */}
        <div className="mb-4 flex items-start gap-3 pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">Asistente de diagnóstico</h2>
            <p className="text-xs text-zinc-500">
              {serviceName}
              {brandName ? ` · ${brandName}` : ""}
            </p>
          </div>
        </div>

        {/* Problema reportado */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Problema reportado
          </div>
          <p className="text-sm text-zinc-700">&ldquo;{problem}&rdquo;</p>
        </div>

        {/* Estados */}
        {loading && (
          <div className="py-12 text-center">
            <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-indigo-500" />
            <p className="text-sm text-zinc-500">Analizando posibles causas y soluciones…</p>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              onClick={onGenerate}
              className="mt-2 block rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && !diagnosis && (
          <div className="py-10 text-center">
            <p className="mb-4 text-sm text-zinc-500">
              Genera posibles causas, cómo verificarlas y soluciones para resolver el trabajo a la primera.
            </p>
            <button
              onClick={onGenerate}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl"
            >
              <Sparkles className="h-4 w-4" />
              Generar posibles soluciones
            </button>
          </div>
        )}

        {/* Resultado */}
        {!loading && diagnosis && (
          <div className="space-y-5">
            {/* Resumen */}
            <p className="text-sm leading-relaxed text-zinc-700">{diagnosis.summary}</p>

            {/* Causas */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Causas probables ({diagnosis.causes.length})
              </h3>
              {diagnosis.causes.map((c, i) => {
                const meta = likelihoodMeta[c.likelihood];
                return (
                  <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-[11px] font-bold text-indigo-600">
                          {i + 1}
                        </span>
                        <span className="text-sm font-semibold text-zinc-900">{c.cause}</span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${meta.cls}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="space-y-1.5 pl-7 text-xs text-zinc-600">
                      <p>
                        <span className="font-semibold text-zinc-500">Verificar: </span>
                        {c.check}
                      </p>
                      <p className="flex items-start gap-1">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                        <span>
                          <span className="font-semibold text-zinc-500">Solución: </span>
                          {c.solution}
                        </span>
                      </p>
                      {c.part && (
                        <p>
                          <span className="font-semibold text-zinc-500">Repuesto: </span>
                          {c.part}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Herramientas + tiempo */}
            <div className="grid gap-3 sm:grid-cols-2">
              {diagnosis.tools.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                    <Wrench className="h-3.5 w-3.5 text-indigo-600" /> Herramientas
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {diagnosis.tools.map((t, i) => (
                      <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-zinc-600">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                  <Clock className="h-3.5 w-3.5 text-indigo-600" /> Tiempo estimado
                </div>
                <span className="text-sm text-zinc-600">{diagnosis.estimatedTime}</span>
              </div>
            </div>

            {/* Seguridad */}
            {diagnosis.safety.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <ShieldAlert className="h-4 w-4" /> Seguridad
                </div>
                <ul className="space-y-1">
                  {diagnosis.safety.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-amber-800/90">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Disclaimer + regenerar */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <p className="text-[10px] leading-tight text-zinc-400">
                Sugerencias generadas por IA. Usa tu criterio profesional y verifica en sitio antes de
                actuar.
              </p>
              <button
                onClick={onRegenerate}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-3 w-3" />
                Regenerar
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
