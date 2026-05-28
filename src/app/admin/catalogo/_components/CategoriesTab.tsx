"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { FolderTree, Plus, Pencil, Trash2 } from "lucide-react";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";
import type { CatRow } from "./types";
import { Modal, Field, TextArea, Toggle, FormError, ModalActions } from "@/components/admin/forms";

// Controlado por el shell (las categorías alimentan el select de Servicios).
export function CategoriesTab({ items, onChange }: { items: CatRow[]; onChange: (rows: CatRow[]) => void }) {
  const [editing, setEditing] = useState<CatRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function toggleActive(c: CatRow) {
    const active = !c.active;
    onChange(items.map((x) => (x.id === c.id ? { ...x, active } : x)));
    await fetch(`/api/admin/categories/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
  }

  async function remove(c: CatRow) {
    if (!confirm(`¿Borrar la categoría "${c.name}"?`)) return;
    const res = await fetch(`/api/admin/categories/${c.id}`, { method: "DELETE" });
    if (res.ok) onChange(items.filter((x) => x.id !== c.id));
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "No se pudo borrar");
    }
  }

  function onSaved(saved: CatRow) {
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
          Nueva categoría
        </button>
      </div>

      <BentoCard className="overflow-hidden">
        <div className="divide-y divide-slate-200/80">
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">Sin categorías.</div>
          ) : (
            items.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50/60">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <BentoIcon tone={c.active ? "indigo" : "zinc"}>
                    <FolderTree className="h-4 w-4" />
                  </BentoIcon>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900">{c.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-zinc-600">orden {c.order}</span>
                      {!c.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">Inactivo</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <code className="text-[10px] text-zinc-400">{c.slug}</code>
                      <span>{c.serviceCount} servicios</span>
                      {c.description && <span className="truncate">{c.description}</span>}
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
          <CategoryModal row={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={onSaved} />
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryModal({ row, onClose, onSaved }: { row: CatRow | null; onClose: () => void; onSaved: (c: CatRow) => void }) {
  const [name, setName] = useState(row?.name ?? "");
  const [slug, setSlug] = useState(row?.slug ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [icon, setIcon] = useState(row?.icon ?? "");
  const [order, setOrder] = useState(String(row?.order ?? 0));
  const [active, setActive] = useState(row?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const url = row ? `/api/admin/categories/${row.id}` : "/api/admin/categories";
      const res = await fetch(url, {
        method: row ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug.trim() || undefined, description, icon, order: parseInt(order, 10) || 0, active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      onSaved({
        id: data.category.id,
        slug: data.category.slug,
        name: data.category.name,
        description: data.category.description,
        icon: data.category.icon,
        order: data.category.order,
        active: data.category.active,
        serviceCount: row?.serviceCount ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={row ? "Editar categoría" : "Nueva categoría"} icon={<FolderTree className="h-4 w-4" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nombre" value={name} onChange={setName} required />
        <Field label="Slug (opcional)" value={slug} onChange={setSlug} placeholder="se genera del nombre" />
        <TextArea label="Descripción" value={description} onChange={setDescription} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ícono (lucide)" value={icon} onChange={setIcon} placeholder="wrench, home, truck…" />
          <Field label="Orden" type="number" value={order} onChange={setOrder} />
        </div>
        <Toggle label="Activa" checked={active} onChange={setActive} />
        <FormError error={error} />
        <ModalActions onCancel={onClose} busy={busy} submitLabel={row ? "Guardar" : "Crear"} />
      </form>
    </Modal>
  );
}
