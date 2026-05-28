"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Wrench, Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

export default function OlvidePassPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_55%)]"
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-[0_20px_80px_-20px_rgba(99,102,241,0.25)] backdrop-blur-md"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/30">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-lg font-semibold text-zinc-900">FixHub</div>
            <div className="text-[11px] uppercase tracking-widest text-zinc-500">
              Recuperar contraseña
            </div>
          </div>
        </div>

        {!sent ? (
          <>
            <h1 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900">¿Olvidaste tu contraseña?</h1>
            <p className="mb-6 text-sm text-zinc-500">
              Te enviamos un enlace para crear una nueva. El correo llega en menos de 1 minuto.
            </p>

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  <Mail className="h-3.5 w-3.5" /> Correo de tu cuenta
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
                />
              </label>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/40 disabled:opacity-50"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative">
                  {loading ? "Enviando..." : "Enviar enlace de recuperación"}
                </span>
              </button>
            </form>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-zinc-900">Revisa tu correo</h2>
            <p className="text-sm text-zinc-600">
              Si existe una cuenta con <strong>{email}</strong>, te enviamos
              un enlace para restablecer tu contraseña.
            </p>
            <p className="mt-3 text-xs text-zinc-400">
              El enlace expira en 1 hora. Revisa también tu carpeta de spam.
            </p>
          </motion.div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/panel/login"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al login
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
