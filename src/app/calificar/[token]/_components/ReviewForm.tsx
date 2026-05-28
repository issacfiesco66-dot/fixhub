"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Star, CheckCircle2 } from "lucide-react";

export function ReviewForm({
  token,
  technicianName,
  serviceName,
}: {
  token: string;
  technicianName: string;
  serviceName: string;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [hadIssue, setHadIssue] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError("Selecciona de 1 a 5 estrellas");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/calificar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, hadIssue, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="mb-1 text-xl font-bold text-zinc-900">¡Gracias por tu opinión!</h1>
        <p className="text-sm text-zinc-500">Tu calificación quedó registrada.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <h1 className="text-xl font-bold tracking-tight text-zinc-900">¿Cómo te fue?</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Califica el servicio de <strong className="text-zinc-700">{serviceName}</strong>
        {technicianName ? (
          <>
            {" "}con <strong className="text-zinc-700">{technicianName}</strong>
          </>
        ) : null}
        .
      </p>

      {/* Estrellas */}
      <div className="my-6 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (hover || rating) >= n;
          return (
            <motion.button
              key={n}
              type="button"
              whileTap={{ scale: 0.85 }}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-1"
              aria-label={`${n} estrellas`}
            >
              <Star
                className={`h-9 w-9 transition-colors ${
                  active ? "fill-amber-400 text-amber-400" : "text-slate-300"
                }`}
              />
            </motion.button>
          );
        })}
      </div>

      {/* ¿Hubo problema? */}
      <button
        type="button"
        onClick={() => setHadIssue((v) => !v)}
        className={`mb-4 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
          hadIssue
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-slate-200 bg-white text-zinc-600"
        }`}
      >
        ¿Tuviste algún problema o usaste la garantía?
        <span
          className={`relative h-5 w-9 rounded-full transition-colors ${hadIssue ? "bg-amber-500" : "bg-zinc-300"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${hadIssue ? "left-4" : "left-0.5"}`}
          />
        </span>
      </button>

      <textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Cuéntanos más (opcional)…"
        className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
      />

      {error && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl disabled:opacity-50"
      >
        {busy ? "Enviando…" : "Enviar calificación"}
      </button>
    </form>
  );
}
