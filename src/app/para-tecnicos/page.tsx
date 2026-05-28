import type { Metadata } from "next";
import Link from "next/link";
import {
  Wrench,
  Sparkles,
  Gift,
  Bell,
  ShieldCheck,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Hammer,
  ClipboardCheck,
  Stethoscope,
} from "lucide-react";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Únete como técnico — leads + IA gratis para tus reparaciones",
  description:
    "Recibe clientes en tu zona, tus primeros 3 servicios gratis y un asistente con IA para diagnósticos de reparación, instalación y mantenimiento. Sin mensualidad.",
  alternates: { canonical: "/para-tecnicos" },
  openGraph: {
    title: "FixHub para técnicos — leads reales + IA para tus reparaciones",
    description:
      "Tus primeros 3 servicios gratis, leads en tu zona en tiempo real y un asistente con IA. Sin mensualidad.",
    locale: "es_MX",
    type: "website",
  },
};

const benefits = [
  {
    icon: Gift,
    title: "Tus primeros 3 servicios gratis",
    desc: "Empieza sin invertir: los primeros 3 leads que tomes son cortesía. Prueba la plataforma y gana tus primeros clientes sin pagar.",
    tone: "emerald" as const,
  },
  {
    icon: Sparkles,
    title: "Asistente con IA para tus trabajos",
    desc: "Una IA que te da posibles causas, pasos y materiales para reparar, instalar o dar mantenimiento a cualquier equipo. Repara a la primera.",
    tone: "indigo" as const,
  },
  {
    icon: Bell,
    title: "Leads en tu zona, en tiempo real",
    desc: "Te avisamos al instante cuando un cliente cerca de ti necesita tu servicio. Tú decides cuáles tomar.",
    tone: "amber" as const,
  },
  {
    icon: Wallet,
    title: "Sin mensualidad",
    desc: "No pagas suscripción. Solo inviertes en los leads que quieres atender. Tú controlas tu gasto.",
    tone: "emerald" as const,
  },
  {
    icon: ShieldCheck,
    title: "Perfil verificado",
    desc: "La verificación de FixHub te da credibilidad frente al cliente y te diferencia de la competencia informal.",
    tone: "indigo" as const,
  },
  {
    icon: Wrench,
    title: "Tú cierras el trato",
    desc: "Te damos el contacto del cliente; el precio del trabajo lo acuerdas directamente tú, sin comisiones sobre tu servicio.",
    tone: "amber" as const,
  },
];

const aiModes = [
  { icon: Stethoscope, label: "Reparación", desc: "Causas probables ordenadas + cómo verificar y resolver." },
  { icon: Hammer, label: "Instalación", desc: "Pasos en orden + materiales y herramientas necesarias." },
  { icon: ClipboardCheck, label: "Mantenimiento", desc: "Checklist preventivo con la frecuencia recomendada." },
];

const steps = [
  { n: 1, title: "Regístrate", desc: "Crea tu perfil, elige tus servicios y tus zonas de cobertura." },
  { n: 2, title: "Te verificamos", desc: "Revisamos tu perfil (normalmente en menos de 24h) y te activamos." },
  { n: 3, title: "Recibe leads", desc: "Te llegan solicitudes en tu zona. Tomas las que quieras — las 3 primeras gratis." },
  { n: 4, title: "Atiende y cobra", desc: "Contactas al cliente, usas el asistente IA si lo necesitas, y cobras tu trabajo." },
];

const toneCls = {
  indigo: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20",
  emerald: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-700 ring-amber-500/30",
} as const;

export default function ParaTecnicosPage() {
  return (
    <main className="relative min-h-screen bg-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[800px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_60%)]"
      />

      {/* Header */}
      <header className="sticky top-0 z-20 w-full border-b border-slate-200/70 bg-white md:bg-white/80 md:backdrop-blur-md">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-10 sm:py-4 lg:px-16">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-zinc-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/30">
              <Wrench className="h-5 w-5" />
            </div>
            <span className="text-lg tracking-tight">FixHub</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/panel/login"
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-zinc-700 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/panel/registro"
              className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition-all hover:shadow-lg"
            >
              Únete gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="w-full px-4 pt-12 pb-10 sm:px-10 sm:pt-16 lg:px-16">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50/80 px-4 py-1.5 text-xs font-medium text-emerald-700">
            <Gift className="h-3.5 w-3.5" />
            Tus primeros 3 servicios son gratis
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-[1.05] tracking-tight text-balance text-zinc-900 sm:text-5xl md:text-6xl">
            Haz crecer tu negocio con{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              clientes reales
            </span>{" "}
            e inteligencia artificial
          </h1>
          <p className="mx-auto mb-9 max-w-2xl text-base leading-relaxed text-zinc-600 md:text-lg">
            FixHub te conecta con clientes en tu zona que necesitan tu servicio, y te da un
            asistente con IA para que repares, instales y des mantenimiento a la primera. Sin
            mensualidad.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/panel/registro"
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-2xl"
            >
              Únete como técnico
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/panel/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-8 py-4 text-base font-medium text-zinc-700 transition-all hover:border-indigo-300 hover:bg-indigo-50"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">¿Por qué FixHub?</h2>
          <p className="mt-1 text-zinc-500">Las herramientas que ningún otro te da</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-bento transition-all hover:border-indigo-300 hover:shadow-[0_12px_40px_-10px_rgba(99,102,241,0.25)]"
              >
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${toneCls[b.tone]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-zinc-900">{b.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-600">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Spotlight IA */}
      <section className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-16">
        <div className="overflow-hidden rounded-[2rem] border border-indigo-200/60 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-8 sm:p-12">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-zinc-900">
              Un asistente con IA en tu bolsillo
            </h2>
            <p className="mb-10 text-base leading-relaxed text-zinc-600">
              ¿Te topaste con una falla que no conocías? Describe el equipo y el problema, y la IA
              te da el diagnóstico, los pasos y los materiales. Funciona para los tres tipos de
              trabajo:
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {aiModes.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="rounded-2xl border border-white/80 bg-white/80 p-5 text-center backdrop-blur">
                  <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1 font-bold text-zinc-900">{m.label}</h3>
                  <p className="text-xs leading-relaxed text-zinc-600">{m.desc}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-zinc-500">
            Incluido sin costo extra · Disponible desde tu panel de técnico
          </p>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Cómo funciona</h2>
          <p className="mt-1 text-zinc-500">Empieza a recibir clientes en 4 pasos</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-3xl border border-slate-200/80 bg-white p-6">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                {s.n}
              </div>
              <h3 className="mb-1 font-bold text-zinc-900">{s.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-16">
        <div className="rounded-[2rem] bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-12 text-center shadow-xl shadow-indigo-500/20 sm:px-12">
          <h2 className="mb-3 text-3xl font-bold tracking-tight text-white">
            Empieza hoy — tus primeros 3 servicios son gratis
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-indigo-100">
            Crea tu perfil en minutos. Sin mensualidad, sin compromiso.
          </p>
          <Link
            href="/panel/registro"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-indigo-700 shadow-lg transition-all hover:scale-[1.02]"
          >
            <CheckCircle2 className="h-5 w-5" />
            Únete como técnico
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
