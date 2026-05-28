import { Search, Send, Wrench } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Describe el problema",
    text: "Dinos qué servicio necesitas, la marca del aparato y tu ciudad. Toma menos de 1 minuto.",
    accent: "from-indigo-500 to-violet-500",
  },
  {
    icon: Send,
    title: "Recibimos tu solicitud",
    text: "Avisamos en segundos a los técnicos verificados en tu zona. El primero en confirmar se queda con el trabajo.",
    accent: "from-amber-500 to-orange-500",
  },
  {
    icon: Wrench,
    title: "Te contacta y lo sigues en vivo",
    text: "El técnico te contacta en minutos y tú sigues su llegada en tiempo real desde tu enlace privado. ¿Cambio de planes? Cancela con anticipación en un clic.",
    accent: "from-emerald-500 to-emerald-600",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-16">
      <div className="mb-12 text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          ¿Cómo funciona?
        </div>
        <h2 className="mb-3 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
          Tu técnico en 3 pasos
        </h2>
        <p className="mx-auto max-w-xl text-zinc-600">
          Sin esperas eternas, sin precios sorpresa. Conexión directa con profesionales verificados.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={i}
            className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.08)] transition-all hover:border-indigo-300 hover:shadow-[0_12px_40px_-10px_rgba(99,102,241,0.25)]"
          >
            <div
              className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${s.accent} text-white shadow-lg`}
            >
              <s.icon className="h-5 w-5" />
            </div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Paso {i + 1}
            </div>
            <h3 className="mb-2 text-lg font-bold text-zinc-900">{s.title}</h3>
            <p className="text-sm leading-relaxed text-zinc-600">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
