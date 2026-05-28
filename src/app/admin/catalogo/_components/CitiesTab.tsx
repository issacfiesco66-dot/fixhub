"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";
import type { CityRow, StateRow } from "./types";
import { Modal, Field, Select, Toggle, FormError, ModalActions } from "@/components/admin/forms";

export function CitiesTab({ initial, states: initialStates }: { initial: CityRow[]; states: StateRow[] }) {
  const [items, setItems] = useState<CityRow[]>(initial);
  const [states, setStates] = useState<StateRow[]>(initialStates);
  const [editing, setEditing] = useState<CityRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function toggleActive(c: CityRow) {
    const active = !c.active;
    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, active } : x)));
    await fetch(`/api/admin/cities/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
  }

  async function remove(c: CityRow) {
    if (!confirm(`¿Borrar "${c.name}"? Si tiene zonas/leads, se bloqueará.`)) return;
    const res = await fetch(`/api/admin/cities/${c.id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== c.id));
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "No se pudo borrar");
    }
  }

  function onSaved(saved: CityRow) {
    setItems((prev) => {
      const exists = prev.some((x) => x.id === saved.id);
      return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved];
    });
    setEditing(null);
    setCreating(false);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          Nueva ciudad
        </button>
      </div>

      <BentoCard className="overflow-hidden">
        <div className="divide-y divide-slate-200/80">
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">Sin ciudades.</div>
          ) : (
            items.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50/60">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <BentoIcon tone={c.active ? "indigo" : "zinc"}>
                    <MapPin className="h-4 w-4" />
                  </BentoIcon>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900">{c.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-zinc-600">{c.stateName}</span>
                      {c.latitude != null && c.longitude != null && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 ring-1 ring-emerald-500/20">geo ✓</span>
                      )}
                      {!c.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">Inactiva</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <code className="text-[10px] text-zinc-400">{c.slug}</code>
                      <span>{c.zoneCount} zonas</span>
                      <span>{c.leadCount} leads</span>
                      <span>{c.coverageCount} técnicos</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(c)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                      c.active ? "border-slate-200 bg-white text-zinc-600 hover:bg-slate-50" : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {c.active ? "Desactivar" : "Activar"}
                  </button>
                  <button onClick={() => setEditing(c)} className="rounded-lg border border-slate-200 bg-white p-2 text-indigo-500 hover:bg-indigo-50" title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(c)} className="rounded-lg border border-slate-200 bg-white p-2 text-red-400 hover:bg-red-50" title="Borrar">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </BentoCard>

      <AnimatePresence>
        {(creating || editing) && (
          <CityModal
            row={editing}
            states={states}
            onStateCreated={(s) => setStates((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)))}
            onClose={() => { setCreating(false); setEditing(null); }}
            onSaved={onSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CityModal({
  row,
  states,
  onStateCreated,
  onClose,
  onSaved,
}: {
  row: CityRow | null;
  states: StateRow[];
  onStateCreated: (s: StateRow) => void;
  onClose: () => void;
  onSaved: (c: CityRow) => void;
}) {
  const [name, setName] = useState(row?.name ?? "");
  const [slug, setSlug] = useState(row?.slug ?? "");
  const [stateId, setStateId] = useState(row?.stateId ?? states[0]?.id ?? "");
  const [active, setActive] = useState(row?.active ?? true);
  const [latitude, setLatitude] = useState(row?.latitude != null ? String(row.latitude) : "");
  const [longitude, setLongitude] = useState(row?.longitude != null ? String(row.longitude) : "");
  const [phone, setPhone] = useState(row?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Crear estado inline
  const [newState, setNewState] = useState("");
  const [stateBusy, setStateBusy] = useState(false);

  async function createState() {
    if (newState.trim().length < 2) return;
    setStateBusy(true);
    try {
      const res = await fetch("/api/admin/states", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newState.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      onStateCreated({ id: data.state.id, name: data.state.name, slug: data.state.slug });
      setStateId(data.state.id);
      setNewState("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear estado");
    } finally {
      setStateBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name,
      slug: slug.trim() || undefined,
      stateId,
      active,
      latitude: latitude.trim() ? parseFloat(latitude) : null,
      longitude: longitude.trim() ? parseFloat(longitude) : null,
      phone,
    };
    try {
      const url = row ? `/api/admin/cities/${row.id}` : "/api/admin/cities";
      const res = await fetch(url, {
        method: row ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      const st = states.find((s) => s.id === stateId);
      onSaved({
        id: data.city.id,
        slug: data.city.slug,
        name: data.city.name,
        stateId: data.city.stateId,
        stateName: st?.name ?? "",
        active: data.city.active,
        latitude: data.city.latitude,
        longitude: data.city.longitude,
        phone: data.city.phone,
        leadCount: row?.leadCount ?? 0,
        zoneCount: row?.zoneCount ?? 0,
        coverageCount: row?.coverageCount ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={row ? "Editar ciudad" : "Nueva ciudad"}
      subtitle="Lat/long alimentan el schema LocalBusiness (Geo-SEO)"
      icon={<MapPin className="h-4 w-4" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nombre" value={name} onChange={setName} required placeholder="Monterrey" />
        <Field label="Slug (opcional)" value={slug} onChange={setSlug} placeholder="se genera del nombre" />

        {states.length > 0 ? (
          <Select label="Estado" value={stateId} onChange={setStateId} required options={states.map((s) => ({ value: s.id, label: s.name }))} />
        ) : (
          <p className="text-xs text-amber-700">No hay estados. Crea uno abajo.</p>
        )}

        {/* Crear estado inline */}
        <div className="flex items-end gap-2 rounded-xl border border-dashed border-slate-300 p-2">
          <div className="flex-1">
            <Field label="+ Nuevo estado" value={newState} onChange={setNewState} placeholder="Nuevo León" />
          </div>
          <button
            type="button"
            onClick={createState}
            disabled={stateBusy || newState.trim().length < 2}
            className="mb-0.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            {stateBusy ? "…" : "Agregar"}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Latitud (opcional)" value={latitude} onChange={setLatitude} placeholder="25.6866" />
          <Field label="Longitud (opcional)" value={longitude} onChange={setLongitude} placeholder="-100.3161" />
        </div>
        <Field label="Teléfono local (opcional)" value={phone} onChange={setPhone} placeholder="81 1234 5678" />
        <Toggle label="Activa" checked={active} onChange={setActive} />
        <FormError error={error} />
        <ModalActions onCancel={onClose} busy={busy} submitLabel={row ? "Guardar" : "Crear ciudad"} />
      </form>
    </Modal>
  );
}
