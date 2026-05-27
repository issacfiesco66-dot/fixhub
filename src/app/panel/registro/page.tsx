"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wrench,
  Mail,
  Lock,
  User,
  Phone,
  Briefcase,
  MapPin,
  CheckCircle2,
  Sparkles,
  AlertCircle,
} from "lucide-react";

type City = { slug: string; name: string; state: string };
type Service = { slug: string; name: string; basePrice: number; category: { slug: string; name: string } };

export default function RegistroPage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    displayName: "",
    bio: "",
    yearsExp: 0,
    citySlugs: [] as string[],
    serviceSlugs: [] as string[],
    acceptTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => {
        setCities(d.cities ?? []);
        setServices(d.services ?? []);
      });
  }, []);

  function toggle(arr: string[], slug: string): string[] {
    return arr.includes(slug) ? arr.filter((s) => s !== slug) : [...arr, slug];
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/technician-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al registrar");
      setSuccess(data.message);
      setTimeout(() => {
        router.push("/panel");
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  }

  // Agrupar servicios por categoría
  const servicesByCategory = services.reduce<Record<string, { name: string; items: Service[] }>>(
    (acc, sv) => {
      const k = sv.category.slug;
      if (!acc[k]) acc[k] = { name: sv.category.name, items: [] };
      acc[k].items.push(sv);
      return acc;
    },
    {}
  );

  if (success) {
    return (
      <main className="relative flex min-h-screen items-center justify-center p-4">
        <Backdrop />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full max-w-md rounded-3xl border border-emerald-300/40 bg-white/90 p-8 text-center shadow-[0_20px_80px_-20px_rgba(16,185,129,0.3)] backdrop-blur-md"
        >
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-zinc-900">¡Cuenta creada!</h1>
          <p className="text-sm text-zinc-600">{success}</p>
          <p className="mt-4 text-xs text-zinc-400">Redirigiendo a tu panel...</p>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen py-12">
      <Backdrop />
      <div className="mx-auto max-w-2xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-white/40 bg-white/80 p-8 shadow-[0_20px_80px_-20px_rgba(99,102,241,0.25)] backdrop-blur-md sm:p-10"
        >
          {/* Header */}
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/30">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight text-zinc-900">FixHub</div>
              <div className="text-[11px] uppercase tracking-widest text-zinc-500">
                Registro de Técnico
              </div>
            </div>
          </div>

          <h1 className="mb-2 text-2xl font-bold tracking-tight text-zinc-900">Únete a la red</h1>
          <p className="mb-8 text-sm text-zinc-500">
            Crea tu cuenta y empieza a recibir solicitudes de clientes en tu zona.
          </p>

          <form onSubmit={submit} className="space-y-6">
            {/* === Datos de acceso === */}
            <Section title="Cuenta" subtitle="Email + contraseña para entrar al panel">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Correo" icon={<Mail className="h-3.5 w-3.5" />}>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className={inputCls}
                    placeholder="tunombre@gmail.com"
                  />
                </Field>
                <Field label="Contraseña" icon={<Lock className="h-3.5 w-3.5" />}>
                  <input
                    type="password"
                    required
                    minLength={10}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    className={inputCls}
                    placeholder="10+ chars, mayús, número"
                  />
                </Field>
              </div>
            </Section>

            {/* === Datos personales === */}
            <Section title="Tus datos" subtitle="Información personal de contacto">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre legal" icon={<User className="h-3.5 w-3.5" />}>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    className={inputCls}
                    placeholder="Juan Pérez García"
                  />
                </Field>
                <Field label="Teléfono" icon={<Phone className="h-3.5 w-3.5" />}>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    className={inputCls}
                    placeholder="+52 33 1234 5678"
                  />
                </Field>
              </div>
            </Section>

            {/* === Perfil profesional === */}
            <Section title="Perfil profesional" subtitle="Cómo te van a ver los clientes">
              <Field label="Nombre profesional" icon={<Briefcase className="h-3.5 w-3.5" />}>
                <input
                  required
                  value={form.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                  className={inputCls}
                  placeholder="Juan Pérez — Técnico Línea Blanca"
                />
              </Field>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Años de experiencia">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={form.yearsExp}
                    onChange={(e) => set("yearsExp", parseInt(e.target.value) || 0)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Bio (opcional)">
                  <input
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    className={inputCls}
                    placeholder="Especialista en marcas premium"
                  />
                </Field>
              </div>
            </Section>

            {/* === Cobertura geográfica === */}
            <Section title="Ciudades que cubres" subtitle="Solo verás leads de estas ciudades">
              <div className="flex flex-wrap gap-2">
                {cities.length === 0 ? (
                  <p className="text-sm text-zinc-500">Cargando ciudades...</p>
                ) : (
                  cities.map((c) => {
                    const selected = form.citySlugs.includes(c.slug);
                    return (
                      <button
                        type="button"
                        key={c.slug}
                        onClick={() => set("citySlugs", toggle(form.citySlugs, c.slug))}
                        className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm transition-all ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-500/20"
                            : "border-slate-200 bg-white text-zinc-600 hover:border-indigo-300 hover:bg-indigo-50/50"
                        }`}
                      >
                        {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                        <MapPin className="h-3 w-3" />
                        {c.name}
                      </button>
                    );
                  })
                )}
              </div>
            </Section>

            {/* === Servicios === */}
            <Section title="Servicios que ofreces" subtitle="Solo verás leads de estos servicios">
              {Object.entries(servicesByCategory).length === 0 ? (
                <p className="text-sm text-zinc-500">Cargando servicios...</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(servicesByCategory).map(([catSlug, cat]) => (
                    <div key={catSlug}>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {cat.name}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cat.items.map((sv) => {
                          const selected = form.serviceSlugs.includes(sv.slug);
                          return (
                            <button
                              type="button"
                              key={sv.slug}
                              onClick={() => set("serviceSlugs", toggle(form.serviceSlugs, sv.slug))}
                              className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm transition-all ${
                                selected
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-500/20"
                                  : "border-slate-200 bg-white text-zinc-600 hover:border-emerald-300 hover:bg-emerald-50/50"
                              }`}
                              title={`$${sv.basePrice} por lead`}
                            >
                              {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                              {sv.name}
                              <span className="text-[10px] text-zinc-400">${sv.basePrice}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* === Términos === */}
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <input
                type="checkbox"
                required
                checked={form.acceptTerms}
                onChange={(e) => set("acceptTerms", e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
              />
              <span className="text-sm text-zinc-700">
                Acepto los términos de uso, la política de privacidad y autorizo a FixHub
                a contactarme con leads que coincidan con mi cobertura.
              </span>
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Aviso de verificación */}
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Tu cuenta queda <strong>pendiente de verificación</strong>. Empezarás a
                recibir leads en cuanto el equipo de FixHub apruebe tu perfil
                (normalmente &lt;24 hrs).
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/40 disabled:opacity-50"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">
                {loading ? "Creando cuenta..." : "Crear mi cuenta de técnico"}
              </span>
            </button>

            <p className="text-center text-xs text-zinc-500">
              ¿Ya tienes cuenta?{" "}
              <Link href="/panel/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Inicia sesión
              </Link>
            </p>
          </form>
        </motion.div>
      </div>
    </main>
  );
}

function Backdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_55%)]"
      />
    </>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2">
        <div className="text-sm font-semibold text-zinc-900">{title}</div>
        {subtitle && <div className="text-xs text-zinc-500">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
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

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15";
