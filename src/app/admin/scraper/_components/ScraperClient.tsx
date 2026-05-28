"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Radar, Search, MapPin, Loader2, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";

type JobState = {
  status: "running" | "done" | "error";
  progress: number;
  message: string;
  log: string[];
  result: { subidos?: number } | null;
  error: string | null;
};

export function ScraperClient({ configured }: { configured: boolean }) {
  const [servicio, setServicio] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [max, setMax] = useState(30);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const running = job?.status === "running";
  const canSearch = servicio.trim().length > 1 && ciudad.trim().length > 1 && !running && !starting;

  async function start() {
    setError(null);
    setStarting(true);
    setJob(null);
    try {
      const res = await fetch("/api/admin/scraper/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servicio, ciudad, max }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar");
      setJobId(data.jobId);
      setJob({ status: "running", progress: 0, message: "Iniciando…", log: [], result: null, error: null });
      poll(data.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setStarting(false);
    }
  }

  function poll(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/scraper/status/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error de estado");
        setJob({
          status: data.status,
          progress: data.progress ?? 0,
          message: data.message ?? "",
          log: data.log ?? [],
          result: data.result ?? null,
          error: data.error ?? null,
        });
        if (data.status === "done" || data.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch (e) {
        if (pollRef.current) clearInterval(pollRef.current);
        setError(e instanceof Error ? e.message : "Error");
      }
    }, 2500);
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-zinc-900">
          <Radar className="h-7 w-7 text-indigo-600" />
          Scraper de prospectos
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Busca centros de servicio por ciudad y los suma a tu pipeline de Prospects para
          invitarlos como técnicos.
        </p>
      </div>

      {!configured && (
        <BentoCard className="mb-6 border-amber-200 bg-amber-50/60 p-4">
          <div className="flex items-start gap-3">
            <BentoIcon tone="amber"><AlertTriangle className="h-4 w-4" /></BentoIcon>
            <div className="text-sm text-amber-800">
              <div className="font-semibold">Servicio de scraping no configurado</div>
              <p className="mt-0.5 text-amber-700">
                Desplegá el servicio Python en Railway y configurá <code className="rounded bg-amber-100 px-1">SCRAPER_SERVICE_URL</code> y{" "}
                <code className="rounded bg-amber-100 px-1">SCRAPER_SERVICE_TOKEN</code> en Vercel. El panel queda listo para conectarse.
              </p>
            </div>
          </div>
        </BentoCard>
      )}

      <BentoCard className="p-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Servicio / rubro</span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
              <Search className="h-4 w-4 text-zinc-400" />
              <input
                value={servicio}
                onChange={(e) => setServicio(e.target.value)}
                placeholder="reparación de electrodomésticos"
                className="h-11 flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Ciudad / estado</span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
              <MapPin className="h-4 w-4 text-zinc-400" />
              <input
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Ciudad de México"
                className="h-11 flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Máx</span>
            <input
              type="number"
              min={1}
              max={50}
              value={max}
              onChange={(e) => setMax(parseInt(e.target.value, 10) || 30)}
              className="h-11 w-20 rounded-xl border border-slate-200 bg-white px-3 text-center text-sm tabular-nums text-zinc-900 focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {servicio && ciudad ? <>Buscará: <span className="font-medium text-zinc-700">{`${servicio.trim()} en ${ciudad.trim()}`}</span></> : "Completa servicio y ciudad."}
          </p>
          <button
            onClick={start}
            disabled={!canSearch || !configured}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 hover:shadow-lg disabled:opacity-40"
          >
            {starting || running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            {running ? "Scrapeando…" : "Iniciar búsqueda"}
          </button>
        </div>

        {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </BentoCard>

      {/* Progreso */}
      {job && (
        <BentoCard className="mt-4 p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-700">{job.message || "Procesando…"}</span>
            <span className="tabular-nums text-zinc-500">{job.progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${job.status === "error" ? "bg-red-500" : "bg-gradient-to-r from-indigo-500 to-violet-600"}`}
              style={{ width: `${job.progress}%` }}
            />
          </div>

          {job.status === "done" && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
              <div className="flex items-center gap-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Listo{job.result?.subidos != null ? ` — ${job.result.subidos} prospectos importados` : ""}.
              </div>
              <Link href="/admin/prospects" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
                Ver en Prospects <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
          {job.status === "error" && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {job.error || "El scraper falló."}
            </div>
          )}

          {job.log.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto rounded-xl bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
              {job.log.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
        </BentoCard>
      )}
    </div>
  );
}
