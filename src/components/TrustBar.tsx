import { ShieldCheck, Clock, BadgeCheck, Headphones } from "lucide-react";

const items = [
  { icon: ShieldCheck, label: "Técnicos verificados", sub: "Identidad validada" },
  { icon: Clock, label: "Respuesta inmediata", sub: "Conexión en <5 min" },
  { icon: BadgeCheck, label: "Garantía por escrito", sub: "30 días en cada reparación" },
  { icon: Headphones, label: "Soporte humano", sub: "Atención por WhatsApp" },
];

export function TrustBar() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10 sm:px-10 lg:px-16">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3 backdrop-blur"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
              <it.icon className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-zinc-900">{it.label}</div>
              <div className="text-[11px] text-zinc-500">{it.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
