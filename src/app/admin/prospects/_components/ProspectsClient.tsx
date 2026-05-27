"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Plus,
  Search,
  Phone,
  MapPin,
  Mail,
  Trash2,
  MessageCircle,
  Filter,
  X,
} from "lucide-react";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";

type Prospect = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string;
  source: string;
  notes: string | null;
  status: "NEW" | "CONTACTED" | "CONVERTED" | "DISCARDED";
  contactedAt: string | null;
  createdAt: string;
};

const STATUSES: Prospect["status"][] = ["NEW", "CONTACTED", "CONVERTED", "DISCARDED"];

const statusMeta: Record<Prospect["status"], { label: string; cls: string; dot: string }> = {
  NEW: { label: "Nuevo", cls: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20", dot: "bg-indigo-400" },
  CONTACTED: { label: "Contactado", cls: "bg-amber-500/10 text-amber-700 ring-amber-500/30", dot: "bg-amber-400" },
  CONVERTED: { label: "Convertido", cls: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20", dot: "bg-emerald-500" },
  DISCARDED: { label: "Descartado", cls: "bg-zinc-100 text-zinc-500 ring-zinc-200", dot: "bg-zinc-500" },
};

export function ProspectsClient({ initial }: { initial: Prospect[] }) {
  const [prospects, setProspects] = useState<Prospect[]>(initial);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Prospect["status"] | "ALL">("ALL");
  const [showCreate, setShowCreate] = useState(false);

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: prospects.length, NEW: 0, CONTACTED: 0, CONVERTED: 0, DISCARDED: 0 };
    for (const p of prospects) map[p.status]++;
    return map;
  }, [prospects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prospects.filter((p) => {
      const matchStatus = filter === "ALL" || p.status === filter;
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.city.toLowerCase().includes(q) ||
        (p.email?.toLowerCase().includes(q) ?? false);
      return matchStatus && matchSearch;
    });
  }, [prospects, search, filter]);

  async function changeStatus(id: string, status: Prospect["status"]) {
    setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    await fetch(`/api/admin/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function deleteOne(id: string) {
    if (!confirm("¿Eliminar este prospect?")) return;
    setProspects((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/admin/prospects/${id}`, { method: "DELETE" });
  }

  function onCreated(p: Prospect) {
    setProspects((prev) => [p, ...prev]);
    setShowCreate(false);
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Target className="h-7 w-7 text-indigo-600" />
            Prospects
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Pipeline de outbound — importa, contacta y convierte.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/30"
        >
          <Plus className="h-4 w-4" />
          Nuevo prospect
        </button>
      </div>

      {/* Filtros + búsqueda */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(["ALL", ...STATUSES] as const).map((s) => {
          const active = filter === s;
          const meta = s === "ALL" ? null : statusMeta[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-700"
                  : "border-slate-200 bg-white/60 text-zinc-500 hover:bg-white"
              }`}
            >
              {meta && <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />}
              {s === "ALL" ? "Todos" : meta!.label}
              <span className="rounded-full bg-slate-100/80 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-700">
                {counts[s]}
              </span>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, ciudad…"
            className="w-64 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Lista */}
      <BentoCard className="overflow-hidden">
        <div className="divide-y divide-slate-200/80">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              <Filter className="mx-auto mb-2 h-5 w-5" />
              No hay prospects con estos filtros.
            </div>
          ) : (
            filtered.map((p) => <ProspectRow key={p.id} prospect={p} onChangeStatus={changeStatus} onDelete={deleteOne} />)
          )}
        </div>
      </BentoCard>

      <AnimatePresence>
        {showCreate && (
          <CreateProspectModal onClose={() => setShowCreate(false)} onCreated={onCreated} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProspectRow({
  prospect,
  onChangeStatus,
  onDelete,
}: {
  prospect: Prospect;
  onChangeStatus: (id: string, status: Prospect["status"]) => void;
  onDelete: (id: string) => void;
}) {
  const meta = statusMeta[prospect.status];
  const cleanPhone = prospect.phone.replace(/\D/g, "");
  const waText = encodeURIComponent(
    `Hola ${prospect.name}, te contactamos de FixHub. ¿Tienes algún electrodoméstico que necesite revisión?`
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50/60">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <BentoIcon tone="indigo">
          <Target className="h-4 w-4" />
        </BentoIcon>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-zinc-900">{prospect.name}</div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${meta.cls}`}>
              <span className={`h-1 w-1 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <a href={`tel:${cleanPhone}`} className="flex items-center gap-1 hover:text-indigo-600">
              <Phone className="h-3 w-3" />
              {prospect.phone}
            </a>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {prospect.city}
            </span>
            {prospect.email && (
              <a href={`mailto:${prospect.email}`} className="flex items-center gap-1 hover:text-indigo-600">
                <Mail className="h-3 w-3" />
                {prospect.email}
              </a>
            )}
            <span className="rounded-full bg-slate-100/80 px-2 py-0.5 text-[10px]">
              {prospect.source}
            </span>
          </div>
          {prospect.notes && (
            <div className="mt-1.5 text-xs italic text-zinc-500">"{prospect.notes}"</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={prospect.status}
          onChange={(e) => onChangeStatus(prospect.id, e.target.value as Prospect["status"])}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusMeta[s].label}
            </option>
          ))}
        </select>
        <a
          href={`https://wa.me/${cleanPhone}?text=${waText}`}
          target="_blank"
          rel="noopener"
          className="rounded-lg border border-slate-200 bg-white p-2 text-emerald-700 hover:bg-emerald-500/10"
          title="WhatsApp"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </a>
        <button
          onClick={() => onDelete(prospect.id)}
          className="rounded-lg border border-slate-200 bg-white p-2 text-red-400 hover:bg-red-50"
          title="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function CreateProspectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: Prospect) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    source: "GoogleMaps_Scraper",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      onCreated({
        ...data.prospect,
        createdAt: data.prospect.createdAt,
        contactedAt: data.prospect.contactedAt ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-50/60 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.08)] backdrop-blur-xl"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <BentoIcon tone="indigo">
            <Plus className="h-4 w-4" />
          </BentoIcon>
          <div>
            <h2 className="text-lg font-semibold">Nuevo prospect</h2>
            <p className="text-xs text-zinc-500">Importar manualmente o desde un scraper</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Input label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
            <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
            <Input label="Fuente" value={form.source} onChange={(v) => setForm({ ...form, source: v })} required />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Notas
            </span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
              placeholder="Contexto del scrape, observaciones..."
            />
          </label>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-zinc-500 hover:bg-slate-100/60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50"
            >
              {busy ? "Creando..." : "Crear prospect"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
      />
    </label>
  );
}
