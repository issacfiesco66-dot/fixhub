"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Users,
  Phone,
  Mail,
  Wallet,
  BadgeCheck,
  MapPin,
  Wrench,
  Pencil,
  Trash2,
  Search,
  Power,
  PowerOff,
  Loader2,
} from "lucide-react";
import { formatMXN } from "@/lib/utils";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";
import { Modal, Field, TextArea, FormError, ModalActions } from "@/components/admin/forms";
import type { Option } from "../../catalogo/_components/types";

type Tech = {
  id: string;
  displayName: string;
  legalName: string | null;
  email: string;
  phone: string | null;
  bio: string | null;
  yearsExp: number;
  balance: number;
  verified: boolean;
  active: boolean;
  purchaseCount: number;
  cityIds: string[];
  serviceIds: string[];
};

export function TechniciansClient({
  initial,
  cities,
  services,
}: {
  initial: Tech[];
  cities: Option[];
  services: Option[];
}) {
  const [items, setItems] = useState<Tech[]>(initial);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Tech | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.displayName.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.phone?.includes(q) ?? false)
    );
  }, [items, search]);

  async function patch(id: string, updates: Partial<Tech> & Record<string, unknown>) {
    const res = await fetch(`/api/admin/technicians/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    return res;
  }

  async function toggleVerified(t: Tech) {
    const verified = !t.verified;
    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, verified } : x)));
    await patch(t.id, { verified });
  }

  async function toggleActive(t: Tech) {
    const active = !t.active;
    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, active } : x)));
    await patch(t.id, { active });
  }

  async function remove(t: Tech) {
    if (!confirm(`¿Borrar a "${t.displayName}" y su cuenta? Si tiene compras, se bloqueará.`)) return;
    const res = await fetch(`/api/admin/technicians/${t.id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== t.id));
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "No se pudo borrar");
    }
  }

  function onSaved(t: Tech) {
    setItems((prev) => prev.map((x) => (x.id === t.id ? t : x)));
    setEditing(null);
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-zinc-900">
            <Users className="h-7 w-7 text-indigo-600" />
            Técnicos
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Registro, verificación y edición de profesionales.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar técnico…"
            className="w-56 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin técnicos.</p>
        ) : (
          filtered.map((t) => (
            <BentoCard key={t.id} className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <BentoIcon tone={t.verified ? "emerald" : "amber"}>
                    {t.verified ? <BadgeCheck className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
                  </BentoIcon>
                  <div>
                    <div className="font-semibold text-zinc-900">{t.displayName}</div>
                    <div className="text-xs text-zinc-500">{t.legalName ?? "Sin nombre legal"}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Saldo</div>
                  <div className="text-lg font-bold tabular-nums text-emerald-700">{formatMXN(t.balance)}</div>
                </div>
              </div>

              <div className="mb-3 space-y-1 text-xs text-zinc-500">
                <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{t.email}</div>
                {t.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{t.phone}</div>}
              </div>

              <div className="space-y-3 border-t border-slate-200/80 pt-3">
                <div className="flex flex-wrap gap-2">
                  <Pill icon={<Wallet className="h-3 w-3" />} label={`${t.purchaseCount} compras`} />
                  <Pill icon={<MapPin className="h-3 w-3" />} label={`${t.cityIds.length} ciudades`} />
                  <Pill icon={<Wrench className="h-3 w-3" />} label={`${t.serviceIds.length} servicios`} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleVerified(t)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                      t.verified
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    <BadgeCheck className="h-3 w-3" />
                    {t.verified ? "Verificado" : "Pendiente"}
                  </button>
                  <button
                    onClick={() => toggleActive(t)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                      t.active
                        ? "border-slate-200 bg-white text-zinc-600 hover:bg-slate-50"
                        : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                    }`}
                  >
                    {t.active ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
                    {t.active ? "Activo" : "Inactivo"}
                  </button>
                  <button
                    onClick={() => setEditing(t)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </button>
                  <button
                    onClick={() => remove(t)}
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-red-400 hover:bg-red-50"
                    title="Borrar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </BentoCard>
          ))
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <TechnicianModal
            tech={editing}
            cities={cities}
            services={services}
            onClose={() => setEditing(null)}
            onSaved={onSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-zinc-600">
      {icon}
      {label}
    </span>
  );
}

function TechnicianModal({
  tech,
  cities,
  services,
  onClose,
  onSaved,
}: {
  tech: Tech;
  cities: Option[];
  services: Option[];
  onClose: () => void;
  onSaved: (t: Tech) => void;
}) {
  const [displayName, setDisplayName] = useState(tech.displayName);
  const [bio, setBio] = useState(tech.bio ?? "");
  const [yearsExp, setYearsExp] = useState(String(tech.yearsExp));
  const [cityIds, setCityIds] = useState<string[]>(tech.cityIds);
  const [serviceIds, setServiceIds] = useState<string[]>(tech.serviceIds);
  const [adjustment, setAdjustment] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const adj = adjustment.trim() ? parseInt(adjustment, 10) : 0;
    try {
      const res = await fetch(`/api/admin/technicians/${tech.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          bio,
          yearsExp: parseInt(yearsExp, 10) || 0,
          cityIds,
          serviceIds,
          ...(adj !== 0 ? { balanceAdjustment: adj, balanceReason: adjustReason || undefined } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      onSaved({
        ...tech,
        displayName,
        bio: bio || null,
        yearsExp: parseInt(yearsExp, 10) || 0,
        cityIds,
        serviceIds,
        balance: data.technician?.balance ?? tech.balance,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Editar técnico"
      subtitle={tech.email}
      icon={<Wrench className="h-4 w-4" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nombre público" value={displayName} onChange={setDisplayName} required />
        <TextArea label="Bio" value={bio} onChange={setBio} placeholder="Experiencia, especialidad…" />
        <Field label="Años de experiencia" type="number" value={yearsExp} onChange={setYearsExp} />

        <MultiSelect label="Ciudades de cobertura" options={cities} selected={cityIds} onToggle={(id) => toggle(cityIds, setCityIds, id)} />
        <MultiSelect label="Servicios que atiende" options={services} selected={serviceIds} onToggle={(id) => toggle(serviceIds, setServiceIds, id)} />

        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            Ajuste de saldo · actual: {formatMXN(tech.balance)}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Monto (+/-)" type="number" value={adjustment} onChange={setAdjustment} placeholder="ej. 500 o -200" />
            <Field label="Motivo" value={adjustReason} onChange={setAdjustReason} placeholder="Bono, corrección…" />
          </div>
          <p className="mt-1.5 text-[10px] text-amber-700/80">Queda registrado como transacción ADJUSTMENT auditable.</p>
        </div>

        <FormError error={error} />
        <ModalActions onCancel={onClose} busy={busy} submitLabel="Guardar cambios" />
      </form>
    </Modal>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label} ({selected.length})
      </span>
      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white/60 p-2">
        {options.length === 0 && <span className="text-xs text-zinc-400">Sin opciones.</span>}
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-all ${
                on
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-zinc-500 hover:bg-slate-50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
