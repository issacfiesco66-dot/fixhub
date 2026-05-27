"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Wrench, Mail, Lock, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/technician-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      router.push("/panel");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  }

  return (
    <main className="dark relative flex min-h-screen items-center justify-center bg-slate-50/40 p-4 text-zinc-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_60%)]" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.08)] backdrop-blur-xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/30">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-lg font-semibold">FixHub</div>
            <div className="text-[11px] uppercase tracking-widest text-zinc-500">
              Panel del Técnico
            </div>
          </div>
        </div>

        <h1 className="mb-1 text-2xl font-bold tracking-tight">Bienvenido</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Accede a tu panel de técnico.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field icon={<Mail className="h-4 w-4" />} label="Correo">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-shadow focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
              required
            />
          </Field>

          <Field icon={<Lock className="h-4 w-4" />} label="Contraseña">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-shadow focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
              required
            />
          </Field>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative inline-flex items-center justify-center gap-2">
              <LogIn className="h-4 w-4" />
              {loading ? "Entrando..." : "Entrar al panel"}
            </span>
          </button>
        </form>

        <div className="mt-6 text-center text-[11px] text-zinc-500">
          ¿Eres admin?{" "}
          <a href="/admin/login" className="text-indigo-600 hover:text-indigo-700">
            Acceder al panel administrativo
          </a>
        </div>
      </motion.div>
    </main>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {icon} {label}
      </span>
      {children}
    </label>
  );
}
