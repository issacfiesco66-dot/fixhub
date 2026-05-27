"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  CheckCircle2,
  Circle,
  Sparkles,
  Copy,
  ExternalLink,
  X,
  Edit3,
  Trash2,
  Wand2,
  Filter,
  Loader2,
  Zap,
  Square,
} from "lucide-react";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";

type Content = {
  id: string;
  h1: string;
  metaTitle: string | null;
  metaDescription: string | null;
  body: string;
  source: string;
  reviewed: boolean;
};

type Tuple = {
  serviceId: string;
  serviceName: string;
  serviceSlug: string;
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
  cityId: string;
  cityName: string;
  citySlug: string;
  stateName: string;
  zones: string[];
  content: Content | null;
};

export function SeoClient({ tuples, totalContents }: { tuples: Tuple[]; totalContents: number }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "FILLED" | "MISSING">("ALL");
  const [editing, setEditing] = useState<Tuple | null>(null);
  // Estado de generación IA por tupla (key: serviceId:brandId:cityId)
  const [generatingKeys, setGeneratingKeys] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<{
    running: boolean;
    done: number;
    total: number;
    ok: number;
    err: number;
    abort: boolean;
  } | null>(null);

  const coverage = useMemo(() => {
    const filled = tuples.filter((t) => t.content).length;
    return {
      filled,
      total: tuples.length,
      pct: tuples.length ? Math.round((filled / tuples.length) * 100) : 0,
    };
  }, [tuples]);

  function tupleKey(t: Tuple) {
    return `${t.serviceId}:${t.brandId ?? "null"}:${t.cityId}`;
  }

  async function generateOne(t: Tuple, force = false) {
    const key = tupleKey(t);
    setGeneratingKeys((s) => new Set(s).add(key));
    try {
      const res = await fetch("/api/admin/seo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: t.serviceId,
          brandId: t.brandId,
          cityId: t.cityId,
          force,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      return data;
    } finally {
      setGeneratingKeys((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleGenerateOne(t: Tuple) {
    try {
      await generateOne(t);
      window.location.reload();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "Falló generación"}`);
    }
  }

  async function handleGenerateAllMissing() {
    const missing = tuples.filter((t) => !t.content);
    if (missing.length === 0) {
      alert("No hay tuplas faltantes.");
      return;
    }
    if (
      !confirm(
        `Vas a generar contenido IA para ${missing.length} tuplas faltantes.\n\n` +
          `Costo estimado: ~$${(missing.length * 0.0003).toFixed(3)} USD (gpt-4o-mini).\n` +
          `Tiempo estimado: ~${Math.ceil((missing.length * 6) / 60)} min.\n\n` +
          `¿Continuar?`
      )
    )
      return;

    setBatch({ running: true, done: 0, total: missing.length, ok: 0, err: 0, abort: false });

    for (let i = 0; i < missing.length; i++) {
      // Permitir cancelar
      const current = batch;
      if (current?.abort) break;

      const t = missing[i];
      try {
        await generateOne(t);
        setBatch((b) => (b ? { ...b, done: b.done + 1, ok: b.ok + 1 } : null));
      } catch {
        setBatch((b) => (b ? { ...b, done: b.done + 1, err: b.err + 1 } : null));
      }
      // pausa para rate limit
      await new Promise((r) => setTimeout(r, 600));
    }

    // Refresh para ver todo lo nuevo
    setTimeout(() => window.location.reload(), 800);
  }

  function abortBatch() {
    setBatch((b) => (b ? { ...b, abort: true, running: false } : null));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tuples.filter((t) => {
      const matchFilter =
        filter === "ALL" ||
        (filter === "FILLED" && t.content) ||
        (filter === "MISSING" && !t.content);
      const matchSearch =
        !q ||
        t.serviceName.toLowerCase().includes(q) ||
        t.cityName.toLowerCase().includes(q) ||
        (t.brandName?.toLowerCase().includes(q) ?? false);
      return matchFilter && matchSearch;
    });
  }, [tuples, search, filter]);

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Globe className="h-7 w-7 text-indigo-600" />
            SEO Programático
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Matriz de contenidos únicos por tupla (servicio × marca × ciudad) para alimentar el motor de SEO local.
          </p>
        </div>

        {coverage.filled < coverage.total && !batch?.running && (
          <button
            onClick={handleGenerateAllMissing}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/30"
          >
            <Wand2 className="h-4 w-4" />
            Generar {coverage.total - coverage.filled} faltantes con IA
          </button>
        )}
      </div>

      {/* Batch progress */}
      <AnimatePresence>
        {batch && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-5 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
                <Loader2 className={`h-4 w-4 ${batch.running ? "animate-spin" : ""}`} />
                {batch.running
                  ? `Generando ${batch.done}/${batch.total}...`
                  : `Generación detenida: ${batch.done}/${batch.total}`}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-700">✓ {batch.ok}</span>
                {batch.err > 0 && <span className="text-red-400">✗ {batch.err}</span>}
                {batch.running && (
                  <button
                    onClick={abortBatch}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-red-700 hover:bg-red-500/15"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    Detener
                  </button>
                )}
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
              <motion.div
                animate={{ width: `${(batch.done / batch.total) * 100}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cobertura */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <BentoCard className="p-5">
          <div className="mb-3">
            <BentoIcon tone="emerald">
              <CheckCircle2 className="h-5 w-5" />
            </BentoIcon>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Cobertura</div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">
            {coverage.pct}%
          </div>
          <div className="text-[11px] text-zinc-500">
            {coverage.filled} / {coverage.total} tuplas con contenido único
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${coverage.pct}%` }}
            />
          </div>
        </BentoCard>

        <BentoCard className="p-5">
          <div className="mb-3">
            <BentoIcon tone="indigo">
              <Sparkles className="h-5 w-5" />
            </BentoIcon>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Páginas indexables</div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">{coverage.total}</div>
          <div className="text-[11px] text-zinc-500">en sitemap.xml</div>
        </BentoCard>

        <BentoCard className="p-5">
          <div className="mb-3">
            <BentoIcon tone="amber">
              <Wand2 className="h-5 w-5" />
            </BentoIcon>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Pendientes de redactar</div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">
            {coverage.total - coverage.filled}
          </div>
          <div className="text-[11px] text-zinc-500">usa el prompt IA debajo →</div>
        </BentoCard>
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(["ALL", "FILLED", "MISSING"] as const).map((f) => {
          const labels = { ALL: "Todos", FILLED: "Con contenido", MISSING: "Faltantes" };
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-700"
                  : "border-slate-200 bg-white/60 text-zinc-500 hover:bg-white"
              }`}
            >
              {labels[f]}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3 py-1.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar servicio / marca / ciudad…"
            className="w-72 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Lista de tuplas */}
      <BentoCard className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            <Filter className="mx-auto mb-2 h-5 w-5" />
            Sin resultados para estos filtros.
          </div>
        ) : (
          <div className="divide-y divide-slate-200/80">
            {filtered.map((t) => {
              const key = tupleKey(t);
              return (
                <TupleRow
                  key={key}
                  tuple={t}
                  generating={generatingKeys.has(key)}
                  onEdit={() => setEditing(t)}
                  onGenerate={() => handleGenerateOne(t)}
                />
              );
            })}
          </div>
        )}
      </BentoCard>

      <AnimatePresence>
        {editing && (
          <EditContentModal
            tuple={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              // Refresh server-side
              window.location.reload();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TupleRow({
  tuple,
  generating,
  onEdit,
  onGenerate,
}: {
  tuple: Tuple;
  generating: boolean;
  onEdit: () => void;
  onGenerate: () => void;
}) {
  const url = tuple.brandSlug
    ? `/${tuple.serviceSlug}-${tuple.brandSlug}-${tuple.citySlug}`
    : `/${tuple.serviceSlug}-${tuple.citySlug}`;
  const filled = !!tuple.content;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50/60 ${generating ? "bg-indigo-500/5" : ""}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {generating ? (
          <BentoIcon tone="indigo">
            <Loader2 className="h-4 w-4 animate-spin" />
          </BentoIcon>
        ) : filled ? (
          <BentoIcon tone="emerald">
            <CheckCircle2 className="h-4 w-4" />
          </BentoIcon>
        ) : (
          <BentoIcon tone="zinc">
            <Circle className="h-4 w-4" />
          </BentoIcon>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold text-zinc-900">
              {tuple.serviceName}
              {tuple.brandName && <span className="text-zinc-500"> · {tuple.brandName}</span>}
              <span className="text-indigo-600"> · {tuple.cityName}</span>
            </div>
            {filled ? (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                {tuple.content!.source}
              </span>
            ) : (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Sin contenido
              </span>
            )}
            {filled && tuple.content!.reviewed && (
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                Revisado
              </span>
            )}
          </div>
          {filled ? (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{tuple.content!.body}</p>
          ) : (
            <p className="mt-1 text-xs italic text-zinc-500">
              Fallback: usa título y descripción genéricos. Recomendado redactar para esta tupla.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="rounded-lg border border-slate-200 bg-white p-2 text-zinc-500 hover:bg-slate-100/60 hover:text-zinc-900"
          title="Ver página"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {!filled && (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-500/20 disabled:opacity-50"
            title="Generar con OpenAI gpt-4o-mini"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            {generating ? "Generando..." : "IA"}
          </button>
        )}
        <button
          onClick={onEdit}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-indigo-500/40 hover:bg-indigo-500/10 disabled:opacity-50"
        >
          <Edit3 className="h-3.5 w-3.5" />
          {filled ? "Editar" : "Redactar"}
        </button>
      </div>
    </div>
  );
}

function EditContentModal({
  tuple,
  onClose,
  onSaved,
}: {
  tuple: Tuple;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [h1, setH1] = useState(tuple.content?.h1 ?? defaultH1(tuple));
  const [metaTitle, setMetaTitle] = useState(tuple.content?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(tuple.content?.metaDescription ?? "");
  const [body, setBody] = useState(tuple.content?.body ?? "");
  const [reviewed, setReviewed] = useState(tuple.content?.reviewed ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const aiPrompt = buildPromptClient(tuple);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/service-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: tuple.serviceId,
          brandId: tuple.brandId,
          cityId: tuple.cityId,
          h1,
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null,
          body,
          source: tuple.content?.source ?? "MANUAL",
          reviewed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteContent() {
    if (!tuple.content) return;
    if (!confirm("¿Eliminar este contenido? La página volverá al fallback genérico.")) return;
    setBusy(true);
    await fetch(`/api/admin/service-content/${tuple.content.id}`, { method: "DELETE" });
    onSaved();
  }

  function copyPrompt() {
    navigator.clipboard.writeText(aiPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-50/60 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.08)] backdrop-blur-xl"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-start gap-3">
          <BentoIcon tone="indigo">
            <Edit3 className="h-4 w-4" />
          </BentoIcon>
          <div>
            <h2 className="text-lg font-semibold">{tuple.content ? "Editar contenido" : "Redactar contenido"}</h2>
            <p className="text-xs text-zinc-500">
              {tuple.serviceName}
              {tuple.brandName && ` · ${tuple.brandName}`} ·{" "}
              <span className="text-indigo-600">{tuple.cityName}, {tuple.stateName}</span>
            </p>
          </div>
        </div>

        {/* Prompt IA — copy/paste a ChatGPT/Claude */}
        <details className="mb-5 rounded-xl border border-indigo-500/30 bg-indigo-500/5">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-indigo-700">
            <Wand2 className="mr-1.5 inline h-3.5 w-3.5" />
            Prompt para generar con IA (ChatGPT / Claude)
          </summary>
          <div className="border-t border-indigo-500/20 p-4">
            <pre className="max-h-48 overflow-y-auto rounded-lg bg-slate-50/60 p-3 text-[11px] text-zinc-700 whitespace-pre-wrap font-mono">{aiPrompt}</pre>
            <button
              onClick={copyPrompt}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-500/10"
            >
              <Copy className="h-3 w-3" />
              {copied ? "¡Copiado!" : "Copiar prompt"}
            </button>
          </div>
        </details>

        <div className="space-y-4">
          <Field label="H1 (título principal)">
            <input
              value={h1}
              onChange={(e) => setH1(e.target.value)}
              maxLength={160}
              className={inputCls}
            />
            <div className="mt-1 text-[10px] text-zinc-500">{h1.length}/160</div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meta title (opcional — sobreescribe <title>)">
              <input
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                maxLength={160}
                className={inputCls}
                placeholder="Si está vacío usa el H1"
              />
            </Field>
            <Field label="Meta description">
              <input
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                maxLength={300}
                className={inputCls}
                placeholder="150-160 caracteres recomendado"
              />
              <div className="mt-1 text-[10px] text-zinc-500">{metaDescription.length}/300</div>
            </Field>
          </div>

          <Field label="Cuerpo (texto indexable — 150 palabras únicas)">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className={inputCls + " font-mono text-xs"}
              placeholder="Pega aquí el texto generado por la IA o escríbelo a mano..."
            />
            <div className="mt-1 text-[10px] text-zinc-500">
              {body.length} caracteres · ~{Math.round(body.split(/\s+/).filter(Boolean).length)} palabras
            </div>
          </Field>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
              className="h-4 w-4 rounded border-slate-200 bg-white text-indigo-500 focus:ring-indigo-500"
            />
            Marcar como revisado (calidad aprobada)
          </label>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {tuple.content && (
              <button
                type="button"
                onClick={deleteContent}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-500/20 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-zinc-500 hover:bg-slate-100/60"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={busy || h1.length < 5 || body.length < 50}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50"
            >
              {busy ? "Guardando..." : "Guardar contenido"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15";

function defaultH1(t: Tuple): string {
  const parts = [t.serviceName];
  if (t.brandName) parts.push(t.brandName);
  parts.push(`en ${t.cityName}`);
  return parts.join(" ");
}

function buildPromptClient(t: Tuple): string {
  const zonesStr = t.zones.slice(0, 6).join(", ") || "todas las zonas";
  const brandLine = t.brandName
    ? `Marca: ${t.brandName}\n`
    : "Marca: (servicio sin marca específica)\n";

  return `Escribe un texto de 150 palabras completamente único y profesional para una landing page de servicios técnicos.

Servicio: ${t.serviceName}
${brandLine}Ubicación: ${t.cityName}, ${t.stateName} (Enfocado en las zonas de ${zonesStr})

Requisitos estrictos de SEO Local:
1. Habla sobre fallas comunes${t.brandName ? ` de ${t.brandName}` : ""} (ej. códigos de error en displays o ruidos en transmisión).
2. Menciona la importancia de realizar reparaciones a domicilio en ${t.cityName} usando refacciones originales.
3. Termina con un llamado a la acción urgente y directo para solicitar la visita de un técnico certificado local.
4. NO repitas frases textuales con otras ciudades. Usa referencias locales propias de ${t.cityName} y sus zonas.
5. Tono: profesional, cercano, sin tecnicismos innecesarios.

Devuelve solo el texto, sin encabezados ni meta-comentarios.`;
}
