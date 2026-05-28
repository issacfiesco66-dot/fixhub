"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Tag, Plus, Pencil, Trash2 } from "lucide-react";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";
import type { BrandRow } from "./types";
import { Modal, Field, Toggle, FormError, ModalActions } from "@/components/admin/forms";

// Controlado por el shell (las marcas alimentan el selector de Servicios).
export function BrandsTab({ items, onChange }: { items: BrandRow[]; onChange: (rows: BrandRow[]) => void }) {
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function toggleActive(b: BrandRow) {
    const active = !b.active;
    onChange(items.map((x) => (x.id === b.id ? { ...x, active } : x)));
    await fetch(`/api/admin/brands/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
  }

  async function remove(b: BrandRow) {
    if (!confirm(`¿Borrar la marca "${b.name}"?`)) return;
    const res = await fetch(`/api/admin/brands/${b.id}`, { method: "DELETE" });
    if (res.ok) onChange(items.filter((x) => x.id !== b.id));
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "No se pudo borrar");
    }
  }

  function onSaved(saved: BrandRow) {
    const exists = items.some((x) => x.id === saved.id);
    onChange(exists ? items.map((x) => (x.id === saved.id ? saved : x)) : [...items, saved]);
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
          Nueva marca
        </button>
      </div>

      <BentoCard className="overflow-hidden">
        <div className="divide-y divide-slate-200/80">
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">Sin marcas.</div>
          ) : (
            items.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50/60">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <BentoIcon tone={b.active ? "indigo" : "zinc"}>
                    <Tag className="h-4 w-4" />
                  </BentoIcon>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900">{b.name}</span>
                      {!b.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">Inactiva</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <code className="text-[10px] text-zinc-400">{b.slug}</code>
                      <span>{b.serviceCount} servicios</span>
                      <span>{b.leadCount} leads</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(b)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                      b.active ? "border-slate-200 bg-white text-zinc-600 hover:bg-slate-50" : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {b.active ? "Desactivar" : "Activar"}
                  </button>
                  <button onClick={() => setEditing(b)} className="rounded-lg border border-slate-200 bg-white p-2 text-indigo-500 hover:bg-indigo-50" title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(b)} className="rounded-lg border border-slate-200 bg-white p-2 text-red-400 hover:bg-red-50" title="Borrar">
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
          <BrandModal row={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={onSaved} />
        )}
      </AnimatePresence>
    </div>
  );
}

function BrandModal({ row, onClose, onSaved }: { row: BrandRow | null; onClose: () => void; onSaved: (b: BrandRow) => void }) {
  const [name, setName] = useState(row?.name ?? "");
  const [slug, setSlug] = useState(row?.slug ?? "");
  const [logo, setLogo] = useState(row?.logo ?? "");
  const [active, setActive] = useState(row?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const url = row ? `/api/admin/brands/${row.id}` : "/api/admin/brands";
      const res = await fetch(url, {
        method: row ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug.trim() || undefined, logo, active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      onSaved({
        id: data.brand.id,
        slug: data.brand.slug,
        name: data.brand.name,
        logo: data.brand.logo,
        active: data.brand.active,
        serviceCount: row?.serviceCount ?? 0,
        leadCount: row?.leadCount ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={row ? "Editar marca" : "Nueva marca"} icon={<Tag className="h-4 w-4" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nombre" value={name} onChange={setName} required placeholder="Mabe, LG, Samsung…" />
        <Field label="Slug (opcional)" value={slug} onChange={setSlug} placeholder="se genera del nombre" />
        <Field label="Logo (URL, opcional)" value={logo} onChange={setLogo} placeholder="/images/brands/mabe.png" />
        <Toggle label="Activa" checked={active} onChange={setActive} />
        <FormError error={error} />
        <ModalActions onCancel={onClose} busy={busy} submitLabel={row ? "Guardar" : "Crear"} />
      </form>
    </Modal>
  );
}
