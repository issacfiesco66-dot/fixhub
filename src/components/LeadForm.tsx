"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  User,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Zap,
  Check,
  CheckCircle2,
  Send,
  Copy,
  ExternalLink,
  WashingMachine,
  Refrigerator,
  Shirt,
  Droplets,
  Wrench,
  Sparkles,
} from "lucide-react";

type Option = { slug: string; name: string };
type ServiceOption = Option & { iconKey?: string };

type Props = {
  serviceSlug: string;
  requiresBrand: boolean;
  availableBrands: Option[];
  presetBrandSlug?: string;
  cities: Option[];
  presetCitySlug?: string;
  zones: Option[];
  // Otros servicios de la misma categoría (para selector visual de aparatos)
  serviceCards?: ServiceOption[];
};

// Mapeo slug → icono Lucide (los iconos viven aquí porque son componentes JSX)
const serviceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "reparacion-lavadoras": WashingMachine,
  "reparacion-refrigeradores": Refrigerator,
  "reparacion-secadoras": Shirt,
  "fuga-de-agua": Droplets,
  "instalacion-electrica": Zap,
};

export function LeadForm({
  serviceSlug,
  requiresBrand,
  availableBrands,
  presetBrandSlug,
  cities,
  presetCitySlug,
  zones,
  serviceCards = [],
}: Props) {
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState(serviceSlug);
  const [form, setForm] = useState({
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    brandSlug: presetBrandSlug ?? "",
    citySlug: presetCitySlug ?? "",
    zoneSlug: "",
    addressHint: "",
    failure: "",
    urgency: "NORMAL" as "NORMAL" | "URGENT" | "EMERGENCY",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            serviceSlug: selectedService,
            source: typeof window !== "undefined" ? window.location.pathname : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al enviar");
        setTrackUrl(typeof data.trackUrl === "string" ? data.trackUrl : null);
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-money-500/30 bg-gradient-to-br from-money-500/10 to-money-500/5 p-8 text-center"
      >
        <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-money-500/15 ring-1 ring-money-500/30">
          <CheckCircle2 className="h-7 w-7 text-money-600" />
        </div>
        <h3 className="mb-1 text-lg font-bold text-zinc-900">¡Solicitud enviada!</h3>
        <p className="text-sm text-zinc-600">
          Un técnico verificado te contactará en los próximos minutos.
        </p>

        {trackUrl && (
          <div className="mt-5 rounded-2xl border border-brand-200 bg-white/80 p-4 text-left">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
              Sigue tu servicio en vivo
            </p>
            <p className="mb-3 text-xs text-zinc-500">
              Mira cuándo tu técnico va en camino y cancela cuando quieras. Sin cuenta —
              guarda este enlace privado.
            </p>
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-600">{trackUrl}</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(trackUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    /* noop */
                  }
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <a
              href={trackUrl}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition-all hover:scale-[1.01]"
            >
              <ExternalLink className="h-4 w-4" />
              Ver seguimiento de mi solicitud
            </a>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* SELECTOR VISUAL DE APARATO (cards con icono) */}
      {serviceCards.length > 1 && (
        <div>
          <Label icon={<Wrench className="h-3.5 w-3.5" />}>¿Qué aparato necesitas reparar?</Label>
          <div className="grid grid-cols-3 gap-2">
            {serviceCards.map((sv) => {
              const Icon = serviceIcons[sv.slug] ?? Sparkles;
              const isSelected = selectedService === sv.slug;
              return (
                <button
                  key={sv.slug}
                  type="button"
                  onClick={() => setSelectedService(sv.slug)}
                  className={`group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all ${
                    isSelected
                      ? "border-brand-500 bg-brand-50/80 shadow-glow-indigo"
                      : "border-zinc-200 bg-white hover:border-brand-300 hover:bg-zinc-50"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                  )}
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      isSelected
                        ? "bg-brand-500/15 text-brand-600"
                        : "bg-zinc-100 text-zinc-500 group-hover:bg-brand-50 group-hover:text-brand-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-center text-[11px] font-medium leading-tight ${
                      isSelected ? "text-brand-700" : "text-zinc-600"
                    }`}
                  >
                    {sv.name.replace(/^Reparación de /, "")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Field label="Tu nombre" icon={<User className="h-3.5 w-3.5" />}>
        <input
          required
          value={form.clientName}
          onChange={(e) => set("clientName", e.target.value)}
          className={inputCls}
          placeholder="Ej. María López"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Teléfono" icon={<Phone className="h-3.5 w-3.5" />}>
          <input
            required
            type="tel"
            value={form.clientPhone}
            onChange={(e) => set("clientPhone", e.target.value)}
            className={inputCls}
            placeholder="33 1234 5678"
          />
        </Field>
        <Field label="Email (opcional)" icon={<Mail className="h-3.5 w-3.5" />}>
          <input
            type="email"
            value={form.clientEmail}
            onChange={(e) => set("clientEmail", e.target.value)}
            className={inputCls}
            placeholder="opcional"
          />
        </Field>
      </div>

      {requiresBrand && availableBrands.length > 0 && (
        <Field label="Marca" icon={<Sparkles className="h-3.5 w-3.5" />}>
          <select
            required
            value={form.brandSlug}
            onChange={(e) => set("brandSlug", e.target.value)}
            className={inputCls}
          >
            <option value="">Selecciona marca…</option>
            {availableBrands.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ciudad" icon={<MapPin className="h-3.5 w-3.5" />}>
          <select
            required
            value={form.citySlug}
            onChange={(e) => set("citySlug", e.target.value)}
            className={inputCls}
          >
            <option value="">Selecciona ciudad…</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {zones.length > 0 && (
          <Field label="Zona (opcional)" icon={<MapPin className="h-3.5 w-3.5" />}>
            <select
              value={form.zoneSlug}
              onChange={(e) => set("zoneSlug", e.target.value)}
              className={inputCls}
            >
              <option value="">No especificar</option>
              {zones.map((z) => (
                <option key={z.slug} value={z.slug}>
                  {z.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <Field label="¿Qué está pasando?" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
        <textarea
          required
          minLength={10}
          rows={3}
          value={form.failure}
          onChange={(e) => set("failure", e.target.value)}
          className={inputCls}
          placeholder="Ej. La lavadora no centrifuga y hace un ruido fuerte al iniciar."
        />
      </Field>

      <Field label="Urgencia">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: "NORMAL", label: "Normal", color: "indigo" },
              { value: "URGENT", label: "Urgente", color: "amber" },
              { value: "EMERGENCY", label: "Emergencia", color: "red" },
            ] as const
          ).map((u) => {
            const sel = form.urgency === u.value;
            const tone = {
              indigo: sel
                ? "border-brand-500 bg-brand-50 text-brand-700 shadow-glow-indigo"
                : "",
              amber: sel
                ? "border-amber-500 bg-amber-50 text-amber-700 shadow-[0_0_0_4px_rgba(245,158,11,0.15)]"
                : "",
              red: sel
                ? "border-red-500 bg-red-50 text-red-700 shadow-glow-red"
                : "",
            }[u.color];
            return (
              <button
                key={u.value}
                type="button"
                onClick={() => set("urgency", u.value)}
                className={`rounded-xl border-2 px-3 py-2 text-sm font-medium transition-all ${
                  sel
                    ? tone
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {u.label}
              </button>
            );
          })}
        </div>
      </Field>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-brand-500/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <span className="relative inline-flex items-center justify-center gap-2">
          {pending ? (
            "Enviando..."
          ) : (
            <>
              <Send className="h-4 w-4" />
              Solicitar técnico ahora
            </>
          )}
        </span>
      </button>

      <p className="flex items-center justify-center gap-1 text-center text-[11px] text-zinc-400">
        <CheckCircle2 className="h-3 w-3" />
        Al enviar aceptas los términos. Sin spam, jamás.
      </p>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 transition-shadow placeholder-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10";

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
      <Label icon={icon}>{label}</Label>
      {children}
    </label>
  );
}

function Label({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
      {icon} {children}
    </span>
  );
}
