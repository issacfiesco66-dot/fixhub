"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wrench,
  CheckCircle2,
  Circle,
  Loader2,
  MapPin,
  Star,
  ShieldCheck,
  XCircle,
  Clock,
  Car,
  Home,
  Sparkles,
} from "lucide-react";

type TrackingData = {
  token: string;
  status: "PENDING" | "PURCHASED" | "EXPIRED" | "CANCELLED";
  jobStatus: "ASSIGNED" | "ON_THE_WAY" | "ARRIVED" | "COMPLETED" | "CANCELLED" | null;
  serviceName: string;
  brandName: string | null;
  cityName: string;
  zoneName: string | null;
  clientName: string;
  failure: string;
  createdAt: string;
  expiresAt: string;
  technician: { name: string; rating: number; totalJobs: number; yearsExp: number } | null;
  reviewUrl: string | null;
  canCancel: boolean;
  timestamps: { onTheWayAt: string | null; arrivedAt: string | null; completedAt: string | null };
};

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TrackingClient({ data }: { data: TrackingData }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const isCancelled = data.status === "CANCELLED" || data.jobStatus === "CANCELLED";
  const isCompleted = data.jobStatus === "COMPLETED";
  const isExpired = data.status === "EXPIRED" && !data.technician;
  const isClosed = isCancelled || isCompleted || isExpired;

  // Refresco automático (sensación de "tiempo real") mientras el trabajo está activo.
  useEffect(() => {
    if (isClosed) return;
    const id = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(id);
  }, [isClosed, router]);

  async function doCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/solicitud/${data.token}/cancel`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo cancelar");
      router.refresh();
      setConfirming(false);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Error");
    } finally {
      setCancelling(false);
    }
  }

  const js = data.jobStatus;
  const reachedAssigned = !!data.technician;
  const reachedOnWay = js === "ON_THE_WAY" || js === "ARRIVED" || js === "COMPLETED";
  const reachedArrived = js === "ARRIVED" || js === "COMPLETED";
  const reachedCompleted = js === "COMPLETED";

  const steps = [
    { label: "Solicitud recibida", hint: "Estamos avisando a los técnicos de tu zona", icon: Sparkles, done: true, time: data.createdAt },
    {
      label: reachedAssigned ? "Técnico asignado" : "Buscando técnico",
      hint: reachedAssigned ? "Un profesional verificado tomó tu servicio" : "Conectando con el primero disponible…",
      icon: ShieldCheck,
      done: reachedAssigned,
      time: null,
    },
    { label: "Va en camino", hint: "Tu técnico salió hacia tu domicilio", icon: Car, done: reachedOnWay, time: data.timestamps.onTheWayAt },
    { label: "Llegó a tu domicilio", hint: "El técnico está contigo", icon: Home, done: reachedArrived, time: data.timestamps.arrivedAt },
    { label: "Servicio completado", hint: "Trabajo terminado", icon: CheckCircle2, done: reachedCompleted, time: data.timestamps.completedAt },
  ];
  // El primer paso no completado es el "activo" (pulsa) — salvo si está cerrado.
  const activeIndex = isClosed ? -1 : steps.findIndex((s) => !s.done);

  return (
    <main className="relative min-h-screen bg-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_60%)]"
      />

      {/* Header */}
      <header className="sticky top-0 z-20 w-full border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-zinc-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/30">
              <Wrench className="h-4 w-4" />
            </div>
            <span className="tracking-tight">FixHub</span>
          </Link>
          <span className="text-xs text-zinc-400">Seguimiento</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8">
        {/* Encabezado del servicio */}
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">Tu solicitud</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
            {data.serviceName}
            {data.brandName && <span className="text-zinc-400"> · {data.brandName}</span>}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
            <MapPin className="h-4 w-4" />
            {data.cityName}
            {data.zoneName ? `, ${data.zoneName}` : ""}
          </p>
        </div>

        {/* Banner de estado cerrado */}
        {isCancelled && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <XCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div>
              <div className="text-sm font-semibold text-red-700">Solicitud cancelada</div>
              <div className="text-xs text-red-600">Esta solicitud fue cancelada. Si lo necesitas, puedes crear una nueva.</div>
            </div>
          </div>
        )}
        {isExpired && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Clock className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <div className="text-sm font-semibold text-amber-700">La solicitud expiró</div>
              <div className="text-xs text-amber-600">Ningún técnico la tomó a tiempo. Vuelve a solicitarla cuando quieras.</div>
            </div>
          </div>
        )}

        {/* Tarjeta del técnico asignado */}
        {data.technician && !isCancelled && (
          <div className="mb-6 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-violet-50/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-200">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
                  {data.technician.name}
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    <ShieldCheck className="h-3 w-3" /> Verificado
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${
                          n <= Math.round(data.technician!.rating || 0)
                            ? "fill-amber-400 text-amber-400"
                            : "text-zinc-300"
                        }`}
                      />
                    ))}
                    <span className="ml-0.5 font-medium text-zinc-700">
                      {data.technician.rating > 0 ? data.technician.rating.toFixed(1) : "Nuevo"}
                    </span>
                  </span>
                  {data.technician.totalJobs > 0 && <span>{data.technician.totalJobs} trabajos</span>}
                  {data.technician.yearsExp > 0 && <span>{data.technician.yearsExp} años exp.</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Línea de tiempo */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ol className="relative">
            {steps.map((step, i) => {
              const isActive = i === activeIndex;
              const Icon = step.icon;
              const last = i === steps.length - 1;
              return (
                <li key={step.label} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* línea conectora */}
                  {!last && (
                    <span
                      aria-hidden
                      className={`absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-0.5 ${
                        step.done ? "bg-emerald-300" : "bg-slate-200"
                      }`}
                    />
                  )}
                  {/* nodo */}
                  <span
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      step.done
                        ? "bg-emerald-500 text-white"
                        : isActive
                        ? "bg-indigo-500 text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </span>
                  {/* texto */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div
                      className={`flex items-center gap-2 text-sm font-semibold ${
                        step.done ? "text-zinc-900" : isActive ? "text-indigo-700" : "text-slate-400"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {step.label}
                      {step.time && (
                        <span className="ml-auto text-[11px] font-normal text-zinc-400">
                          {fmtTime(step.time)}
                        </span>
                      )}
                    </div>
                    <p className={`mt-0.5 text-xs ${isActive ? "text-zinc-600" : "text-zinc-400"}`}>
                      {step.hint}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* CTA calificar (completado) */}
        {isCompleted && data.reviewUrl && (
          <Link
            href={data.reviewUrl}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl"
          >
            <Star className="h-4 w-4" />
            Califica tu servicio
          </Link>
        )}

        {/* Cancelar */}
        {data.canCancel && !isCancelled && (
          <div className="mt-5">
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                Cancelar solicitud
              </button>
            ) : (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="mb-3 text-sm text-red-700">
                  ¿Seguro que quieres cancelar tu servicio de <strong>{data.serviceName}</strong>?
                </p>
                {cancelError && <p className="mb-2 text-xs text-red-600">{cancelError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={doCancel}
                    disabled={cancelling}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                  >
                    {cancelling ? "Cancelando…" : "Sí, cancelar"}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={cancelling}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-slate-50"
                  >
                    No, mantener
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-zinc-400">
          Esta página se actualiza sola. Guárdala para seguir tu servicio en cualquier momento.
        </p>
      </div>
    </main>
  );
}
