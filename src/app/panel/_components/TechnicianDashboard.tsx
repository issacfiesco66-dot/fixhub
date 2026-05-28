"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  Briefcase,
  ShieldCheck,
  Bell,
  Plus,
  LogOut,
  Sparkles,
  MapPin,
  Wrench,
} from "lucide-react";
import { formatMXN } from "@/lib/utils";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";
import { LeadAlertModal } from "./LeadAlertModal";
import { ContactRevealModal } from "./ContactRevealModal";
import { RechargeModal } from "./RechargeModal";
import { LeadCard } from "./LeadCard";
import { DiagnosisModal } from "./DiagnosisModal";
import type { RepairDiagnosis } from "@/lib/ai-diagnosis";

type Lead = {
  id: string;
  failure: string;
  urgency: "NORMAL" | "URGENT" | "EMERGENCY";
  price: number;
  createdAt: string;
  expiresAt: string;
  addressHint: string | null;
  service: { name: string };
  brand: { name: string } | null;
  city: { name: string };
  zone: { name: string } | null;
};

type Purchase = {
  id: string;
  leadId: string;
  pricePaid: number;
  createdAt: string;
  serviceName: string;
  brandName: string | null;
  cityName: string;
  zoneName: string | null;
  clientName: string;
  clientPhone: string;
  failure: string;
  diagnosis: RepairDiagnosis | null;
};

type AlertPayload = {
  type: "NEW_LEAD";
  leadId: string;
  service: string;
  serviceSlug: string;
  brand: string | null;
  city: string;
  zone: string | null;
  failure: string;
  urgency: "NORMAL" | "URGENT" | "EMERGENCY";
  price: number;
  viewersHint: number;
  expiresAt: string;
  createdAt: string;
};

type Props = {
  technician: {
    id: string;
    name: string;
    balance: number;
    verified: boolean;
    coverages: { id: string; name: string }[];
    services: { id: string; name: string }[];
  };
  initialLeads: Lead[];
  recentPurchases: Purchase[];
  packages: { id: string; name: string; amount: number; bonus: number; popular: boolean }[];
};

export function TechnicianDashboard({
  technician,
  initialLeads,
  recentPurchases,
  packages,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState(technician.balance);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [activeAlert, setActiveAlert] = useState<AlertPayload | null>(null);
  const [revealedContact, setRevealedContact] = useState<{
    name: string;
    phone: string;
    email?: string | null;
    addressHint?: string | null;
    service: string;
    city: string;
  } | null>(null);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeReason, setRechargeReason] = useState<"manual" | "insufficient">("manual");
  const [connected, setConnected] = useState(false);
  // Asistente de diagnóstico IA
  const [purchases, setPurchases] = useState<Purchase[]>(recentPurchases);
  const [diagTarget, setDiagTarget] = useState<Purchase | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);

  const playPing = () => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      /* silencio si no hay audio */
    }
  };

  // Polling cada 5s contra /api/leads/feed (Vercel-compatible).
  // El servidor filtra server-side por coverage + verified.
  useEffect(() => {
    let cancelled = false;
    let lastSeen = new Date().toISOString();
    const knownIds = new Set(initialLeads.map((l) => l.id));

    async function poll() {
      try {
        const res = await fetch(`/api/leads/feed?since=${encodeURIComponent(lastSeen)}`);
        if (!res.ok) {
          setConnected(false);
          return;
        }
        const data = await res.json();
        setConnected(true);
        lastSeen = data.serverTime ?? lastSeen;

        if (!cancelled && Array.isArray(data.leads) && data.leads.length > 0) {
          // Filtrar solo los que no conocemos para no triggear alerta de cosas viejas
          const fresh = data.leads.filter((l: Lead) => !knownIds.has(l.id));
          if (fresh.length === 0) return;

          for (const l of fresh) knownIds.add(l.id);

          // Mostrar alerta para el más reciente
          const newest = fresh[0];
          playPing();
          setActiveAlert({
            type: "NEW_LEAD",
            leadId: newest.id,
            service: newest.service.name,
            serviceSlug: "",
            brand: newest.brand?.name ?? null,
            city: newest.city.name,
            zone: newest.zone?.name ?? null,
            failure: newest.failure,
            urgency: newest.urgency,
            price: newest.price,
            viewersHint: 2 + Math.floor(Math.random() * 3),
            expiresAt: newest.expiresAt,
            createdAt: newest.createdAt,
          });

          // Prepend al panel
          setLeads((prev) => {
            const existing = new Set(prev.map((p) => p.id));
            const additions = fresh.filter((l: Lead) => !existing.has(l.id));
            return [...additions, ...prev];
          });
        }
      } catch {
        setConnected(false);
      }
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchParams.get("recarga") === "ok") {
      fetch("/api/billing/me")
        .then((r) => r.json())
        .then((d) => setBalance(d.balance ?? 0));
    }
  }, [searchParams]);

  async function handlePurchase(leadId: string) {
    const res = await fetch(`/api/leads/${leadId}/purchase`, { method: "POST" });
    const data = await res.json();

    if (res.status === 402 && data.code === "INSUFFICIENT_FUNDS") {
      setActiveAlert(null);
      setRechargeReason("insufficient");
      setShowRecharge(true);
      return;
    }
    if (res.status === 409 && data.code === "LEAD_TAKEN") {
      setActiveAlert(null);
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      return;
    }
    if (!res.ok) {
      alert(data.error ?? "Error al comprar lead");
      return;
    }

    setBalance(data.newBalance);
    setActiveAlert(null);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setRevealedContact({
      name: data.contact.clientName,
      phone: data.contact.clientPhone,
      email: data.contact.clientEmail,
      addressHint: data.contact.addressHint,
      service: data.lead.service,
      city: data.lead.city,
    });
    router.refresh();
  }

  async function runDiagnosis(target: Purchase, regenerate: boolean) {
    setDiagLoading(true);
    setDiagError(null);
    try {
      const res = await fetch(`/api/leads/${target.leadId}/diagnosis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo generar el diagnóstico");
      const diagnosis = data.diagnosis as RepairDiagnosis;
      setPurchases((prev) => prev.map((p) => (p.id === target.id ? { ...p, diagnosis } : p)));
      setDiagTarget((prev) => (prev ? { ...prev, diagnosis } : prev));
    } catch (e) {
      setDiagError(e instanceof Error ? e.message : "Error");
    } finally {
      setDiagLoading(false);
    }
  }

  const lowBalance = balance < 450;

  return (
    <div className="relative min-h-screen bg-slate-50/40 text-zinc-900">
      {/* Patrón dotted + glow indigo — mismo lenguaje visual que la home */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_55%)]"
      />

      {/* ── Header — light glass full-width ──────────────────── */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/70 bg-white/70 backdrop-blur-md">
        <div className="flex w-full items-center justify-between px-6 py-4 sm:px-10 lg:px-16">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/30">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="font-semibold tracking-tight">FixHub</div>
              <div className="text-[11px] uppercase tracking-widest text-zinc-500">
                Panel del Técnico
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ConnectionIndicator connected={connected} />

            <div className="hidden items-center gap-2.5 rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2 sm:flex">
              <Wallet className="h-4 w-4 text-emerald-700" />
              <div className="leading-tight">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">Saldo</div>
                <div
                  className={`text-sm font-semibold tabular-nums ${
                    lowBalance ? "text-red-400" : "text-zinc-900"
                  }`}
                >
                  {formatMXN(balance)}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setRechargeReason("manual");
                setShowRecharge(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" />
              Recargar
            </button>

            <form action="/api/auth/technician-logout" method="post">
              <button
                type="submit"
                className="rounded-xl border border-slate-200 p-2 text-zinc-500 transition-colors hover:bg-white hover:text-zinc-900"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-8 sm:px-10 lg:px-16">
        {/* ── Banner: cuenta sin verificar (bloquea compra de leads) ── */}
        {!technician.verified && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm shadow-sm shadow-amber-500/10"
          >
            <Sparkles className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-amber-800">
              <div className="font-semibold">Tu cuenta está pendiente de verificación</div>
              <div className="mt-0.5 text-amber-700">
                Mientras tanto NO recibes leads. El equipo de FixHub está revisando tu perfil
                (normalmente &lt;24 hrs). Te avisamos en cuanto te aprobemos.
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Hero greeting ────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Hola, {technician.name.split(" ")[0]}
              <Sparkles className="ml-2 inline h-6 w-6 text-amber-700" />
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Hoy estás cubriendo{" "}
              <span className="font-medium text-zinc-700">
                {technician.services.length} servicios
              </span>{" "}
              en{" "}
              <span className="font-medium text-zinc-700">
                {technician.coverages.length} ciudades
              </span>
              .
            </p>
          </div>
          {lowBalance && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-sm text-red-700"
            >
              <Bell className="h-4 w-4 animate-pulse" />
              Saldo bajo — podrías perder leads
            </motion.div>
          )}
        </div>

        {/* ── BENTO GRID ───────────────────────────────────── */}
        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <BentoStat
            tone="emerald"
            icon={<Wallet className="h-5 w-5" />}
            label="Saldo disponible"
            value={formatMXN(balance)}
            hint={`≈ ${Math.floor(balance / 450)} leads`}
            big
          />
          <BentoStat
            tone="indigo"
            icon={<Bell className="h-5 w-5" />}
            label="Leads en vivo"
            value={String(leads.length)}
            hint="en tu zona"
          />
          <BentoStat
            tone="amber"
            icon={<Briefcase className="h-5 w-5" />}
            label="Trabajos comprados"
            value={String(purchases.length)}
            hint="últimos 10"
          />
          <BentoStat
            tone={technician.verified ? "emerald" : "zinc"}
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Estado de cuenta"
            value={technician.verified ? "Verificado" : "Pendiente"}
            hint={technician.verified ? "Apto para comprar" : "En revisión"}
          />
        </div>

        {/* ── Leads disponibles ──────────────────────────── */}
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Leads disponibles en tu zona
              </h2>
              <p className="text-xs text-zinc-500">Actualización en tiempo real</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-zinc-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </div>
          </div>

          {leads.length === 0 ? (
            <BentoCard className="border-dashed py-16 text-center">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100/60">
                <Bell className="h-5 w-5 text-zinc-500" />
              </div>
              <p className="text-sm text-zinc-500">
                Sin leads activos. Te avisaremos al instante cuando aparezca uno.
              </p>
            </BentoCard>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence>
                {leads.map((lead) => (
                  <motion.div
                    key={lead.id}
                    layout
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
                  >
                    <LeadCard lead={lead} onPurchase={() => handlePurchase(lead.id)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </section>

        {/* ── Historial ───────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Mis trabajos comprados</h2>
          {purchases.length === 0 ? (
            <p className="text-sm text-zinc-500">Aún no has comprado ningún lead.</p>
          ) : (
            <BentoCard className="divide-y divide-slate-200/80 overflow-hidden">
              {purchases.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <BentoIcon tone="indigo">
                        <Briefcase className="h-4 w-4" />
                      </BentoIcon>
                      <div>
                        <div className="text-sm font-medium text-zinc-900">
                          {p.serviceName}
                          {p.brandName && (
                            <span className="text-zinc-500"> · {p.brandName}</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span>{p.clientName}</span>
                          <span className="text-zinc-700">•</span>
                          <MapPin className="h-3 w-3" />
                          <span>
                            {p.cityName}
                            {p.zoneName ? `, ${p.zoneName}` : ""}
                          </span>
                          <span className="text-zinc-700">•</span>
                          <a
                            href={`tel:${p.clientPhone}`}
                            className="text-indigo-600 hover:underline"
                          >
                            {p.clientPhone}
                          </a>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums text-red-400">
                        -{formatMXN(p.pricePaid)}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {new Date(p.createdAt).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Problema + asistente de diagnóstico IA */}
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <p className="line-clamp-1 flex-1 text-xs italic text-zinc-400">
                      &ldquo;{p.failure}&rdquo;
                    </p>
                    <button
                      onClick={() => {
                        setDiagError(null);
                        setDiagTarget(p);
                      }}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {p.diagnosis ? "Ver soluciones" : "Soluciones IA"}
                    </button>
                  </div>
                </div>
              ))}
            </BentoCard>
          )}
        </section>
      </main>

      {/* ── Modales flotantes ────────────────────────────── */}
      <AnimatePresence>
        {activeAlert && (
          <LeadAlertModal
            key={activeAlert.leadId}
            alert={activeAlert}
            onAccept={() => handlePurchase(activeAlert.leadId)}
            onClose={() => setActiveAlert(null)}
          />
        )}
        {revealedContact && (
          <ContactRevealModal
            contact={revealedContact}
            onClose={() => setRevealedContact(null)}
          />
        )}
        {showRecharge && (
          <RechargeModal
            packages={packages}
            balance={balance}
            reason={rechargeReason}
            onClose={() => setShowRecharge(false)}
          />
        )}
        {diagTarget && (
          <DiagnosisModal
            serviceName={diagTarget.serviceName}
            brandName={diagTarget.brandName}
            problem={diagTarget.failure}
            diagnosis={diagTarget.diagnosis}
            loading={diagLoading}
            error={diagError}
            onGenerate={() => runDiagnosis(diagTarget, false)}
            onRegenerate={() => runDiagnosis(diagTarget, true)}
            onClose={() => setDiagTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-componentes ─────────────────────────────────────────

function BentoStat({
  tone,
  icon,
  label,
  value,
  hint,
  big = false,
}: {
  tone: "indigo" | "emerald" | "amber" | "red" | "zinc";
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  big?: boolean;
}) {
  return (
    <BentoCard className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <BentoIcon tone={tone}>{icon}</BentoIcon>
      </div>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 font-bold tabular-nums text-zinc-900 ${big ? "text-3xl" : "text-2xl"}`}>
        {value}
      </div>
      <div className="text-[11px] text-zinc-500">{hint}</div>
    </BentoCard>
  );
}

function ConnectionIndicator({ connected }: { connected: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        connected
          ? "border-emerald-300 bg-emerald-500/10 text-emerald-700"
          : "border-amber-300 bg-amber-500/10 text-amber-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          connected ? "animate-pulse bg-emerald-500" : "animate-pulse bg-amber-400"
        }`}
      />
      {connected ? "EN VIVO" : "CONECTANDO"}
    </div>
  );
}
