"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Wrench, Plus, Search, Pencil, Trash2, Tag } from "lucide-react";
import { formatMXN } from "@/lib/utils";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";
import type { SvcRow, CatRow, BrandRow } from "./types";
import { Modal, Field, TextArea, Select, Toggle, FormError, ModalActions } from "@/components/admin/forms";

export function ServicesTab({
  initial,
  categories,
  brands,
}: {
  initial: SvcRow[];
  categories: CatRow[];
  brands: BrandRow[];
}) {
  const [items, setItems] = useState<SvcRow[]>(initial);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SvcRow | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (s) => s.name.toLowerCase().includes(q) || s.slug.includes(q) || s.categoryName.toLowerCase().includes(q)
    );
  }, [items, search]);

  async function toggleActive(s: SvcRow) {
    const active = !s.active;
    setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, active } : x)));
    await fetch(`/api/admin/services/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
  }

  async function remove(s: SvcRow) {
    if (!confirm(`¿Borrar "${s.name}"? Si tiene leads/técnicos, se bloqueará.`)) return;
    const res = await fetch(`/api/admin/services/${s.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== s.id));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "No se pudo borrar");
    }
  }

  function onSaved(saved: SvcRow) {
    setItems((prev) => {
      const exists = prev.some((x) => x.id === saved.id);
      return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
    });
    setEditing(null);
    setCreating(false);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar servicio…"
            className="w-64 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          Nuevo servicio
        </button>
      </div>

      <BentoCard className="overflow-hidden">
        <div className="divide-y divide-slate-200/80">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">Sin servicios.</div>
          ) : (
            filtered.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50/60">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <BentoIcon tone={s.active ? "indigo" : "zinc"}>
                    <Wrench className="h-4 w-4" />
                  </BentoIcon>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900">{s.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-zinc-600">{s.categoryName}</span>
                      {s.requiresBrand && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-700 ring-1 ring-violet-500/20">
                          <Tag className="h-2.5 w-2.5" /> {s.brandIds.length} marcas
                        </span>
                      )}
                      {!s.active && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">Inactivo</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <code className="text-[10px] text-zinc-400">/{s.slug}</code>
                      <span className="font-medium text-emerald-700">{formatMXN(s.basePrice)}</span>
                      <span>{s.leadCount} leads</span>
                      <span>{s.technicianCount} técnicos</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(s)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                      s.active
                        ? "border-slate-200 bg-white text-zinc-600 hover:bg-slate-50"
                        : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {s.active ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() => setEditing(s)}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-indigo-500 hover:bg-indigo-50"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove(s)}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-red-400 hover:bg-red-50"
                    title="Borrar"
                  >
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
          <ServiceModal
            row={editing}
            categories={categories}
            brands={brands}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSaved={onSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ServiceModal({
  row,
  categories,
  brands,
  onClose,
  onSaved,
}: {
  row: SvcRow | null;
  categories: CatRow[];
  brands: BrandRow[];
  onClose: () => void;
  onSaved: (s: SvcRow) => void;
}) {
  const [name, setName] = useState(row?.name ?? "");
  const [slug, setSlug] = useState(row?.slug ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [categoryId, setCategoryId] = useState(row?.categoryId ?? categories[0]?.id ?? "");
  const [requiresBrand, setRequiresBrand] = useState(row?.requiresBrand ?? false);
  const [basePrice, setBasePrice] = useState(String(row?.basePrice ?? 450));
  const [active, setActive] = useState(row?.active ?? true);
  const [brandIds, setBrandIds] = useState<string[]>(row?.brandIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleBrand(id: string) {
    setBrandIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name,
      slug: slug.trim() || undefined,
      description,
      categoryId,
      requiresBrand,
      basePrice: parseInt(basePrice, 10) || 0,
      active,
      brandIds: requiresBrand ? brandIds : [],
    };
    try {
      const url = row ? `/api/admin/services/${row.id}` : "/api/admin/services";
      const res = await fetch(url, {
        method: row ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      const cat = categories.find((c) => c.id === categoryId);
      onSaved({
        id: data.service.id,
        slug: data.service.slug,
        name: data.service.name,
        description: data.service.description,
        categoryId: data.service.categoryId,
        categoryName: cat?.name ?? "",
        requiresBrand: data.service.requiresBrand,
        basePrice: data.service.basePrice,
        active: data.service.active,
        brandIds: requiresBrand ? brandIds : [],
        leadCount: row?.leadCount ?? 0,
        technicianCount: row?.technicianCount ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={row ? "Editar servicio" : "Nuevo servicio"}
      subtitle={row ? `/${row.slug}` : "Aparecerá en el buscador y el catálogo"}
      icon={<Wrench className="h-4 w-4" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nombre" value={name} onChange={setName} required placeholder="Reparación de Bombas de Agua" />
        <Field
          label="Slug (opcional)"
          value={slug}
          onChange={setSlug}
          placeholder="se genera del nombre"
          hint="URL: /reparacion-bombas-agua. Solo minúsculas, números y guiones."
        />
        <TextArea label="Descripción" value={description} onChange={setDescription} placeholder="Qué cubre el servicio…" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Categoría"
            value={categoryId}
            onChange={setCategoryId}
            required
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Field label="Precio del lead (MXN)" type="number" value={basePrice} onChange={setBasePrice} required />
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle label="Activo" checked={active} onChange={setActive} />
          <Toggle label="Requiere marca" checked={requiresBrand} onChange={setRequiresBrand} />
        </div>

        {requiresBrand && (
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Marcas que aplican
            </span>
            <div className="flex flex-wrap gap-1.5">
              {brands.length === 0 && (
                <span className="text-xs text-zinc-400">No hay marcas. Crea algunas en la pestaña Marcas.</span>
              )}
              {brands.map((b) => {
                const on = brandIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBrand(b.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-all ${
                      on
                        ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-zinc-500 hover:bg-slate-50"
                    }`}
                  >
                    {b.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <FormError error={error} />
        <ModalActions onCancel={onClose} busy={busy} submitLabel={row ? "Guardar cambios" : "Crear servicio"} />
      </form>
    </Modal>
  );
}
