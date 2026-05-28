"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Users, Plus, Search, Pencil, Trash2, Mail, Phone, Shield, Wrench, User as UserIcon } from "lucide-react";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";
import { Modal, Field, Select, FormError, ModalActions } from "@/components/admin/forms";

type Role = "CLIENT" | "TECHNICIAN" | "ADMIN";

type Row = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  isTechnician: boolean;
  leadCount: number;
  createdAt: string;
};

const roleMeta: Record<Role, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  ADMIN: { label: "Admin", cls: "bg-violet-500/10 text-violet-700 ring-violet-500/20", icon: Shield },
  TECHNICIAN: { label: "Técnico", cls: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/20", icon: Wrench },
  CLIENT: { label: "Cliente", cls: "bg-slate-100 text-zinc-600 ring-slate-200", icon: UserIcon },
};

const ROLES: Role[] = ["CLIENT", "TECHNICIAN", "ADMIN"];

export function UsersClient({ initial, currentAdminId }: { initial: Row[]; currentAdminId: string }) {
  const [items, setItems] = useState<Row[]>(initial);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const m: Record<string, number> = { ALL: items.length, CLIENT: 0, TECHNICIAN: 0, ADMIN: 0 };
    for (const u of items) m[u.role]++;
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (q && !u.email.toLowerCase().includes(q) && !(u.name?.toLowerCase().includes(q) ?? false)) return false;
      return true;
    });
  }, [items, search, roleFilter]);

  async function remove(u: Row) {
    if (u.id === currentAdminId) return;
    if (!confirm(`¿Borrar a "${u.name ?? u.email}"?`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== u.id));
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "No se pudo borrar");
    }
  }

  function onSaved(saved: Row) {
    setItems((prev) => {
      const exists = prev.some((x) => x.id === saved.id);
      return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
    });
    setEditing(null);
    setCreating(false);
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-zinc-900">
            <Users className="h-7 w-7 text-indigo-600" />
            Usuarios
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Clientes, técnicos y administradores.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(["ALL", ...ROLES] as const).map((r) => {
          const active = roleFilter === r;
          const meta = r === "ALL" ? null : roleMeta[r];
          return (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                active ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-700" : "border-slate-200 bg-white/60 text-zinc-500 hover:bg-white"
              }`}
            >
              {r === "ALL" ? "Todos" : meta!.label}
              <span className="rounded-full bg-slate-100/80 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-700">{counts[r]}</span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por email o nombre…"
            className="w-64 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
          />
        </div>
      </div>

      <BentoCard className="overflow-hidden">
        <div className="divide-y divide-slate-200/80">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">Sin usuarios.</div>
          ) : (
            filtered.map((u) => {
              const meta = roleMeta[u.role];
              const Icon = meta.icon;
              const isSelf = u.id === currentAdminId;
              return (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50/60">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <BentoIcon tone={u.role === "ADMIN" ? "indigo" : "zinc"}>
                      <Icon className="h-4 w-4" />
                    </BentoIcon>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-900">{u.name ?? u.email}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${meta.cls}`}>
                          {meta.label}
                        </span>
                        {isSelf && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 ring-1 ring-emerald-500/20">tú</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{u.email}</span>
                        {u.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{u.phone}</span>}
                        {u.leadCount > 0 && <span>{u.leadCount} leads</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditing(u)} className="rounded-lg border border-slate-200 bg-white p-2 text-indigo-500 hover:bg-indigo-50" title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(u)}
                      disabled={isSelf}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                      title={isSelf ? "No puedes borrarte" : "Borrar"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </BentoCard>

      <AnimatePresence>
        {(creating || editing) && (
          <UserModal
            row={editing}
            isSelf={editing?.id === currentAdminId}
            onClose={() => { setCreating(false); setEditing(null); }}
            onSaved={onSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function UserModal({
  row,
  isSelf,
  onClose,
  onSaved,
}: {
  row: Row | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (u: Row) => void;
}) {
  const [email, setEmail] = useState(row?.email ?? "");
  const [name, setName] = useState(row?.name ?? "");
  const [phone, setPhone] = useState(row?.phone ?? "");
  const [role, setRole] = useState<Role>(row?.role ?? "CLIENT");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const url = row ? `/api/admin/users/${row.id}` : "/api/admin/users";
      const payload = row
        ? { name, phone, role, ...(password ? { password } : {}) }
        : { email, name, phone, role, ...(password ? { password } : {}) };
      const res = await fetch(url, {
        method: row ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      onSaved({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        phone: data.user.phone,
        role: data.user.role,
        isTechnician: row?.isTechnician ?? false,
        leadCount: row?.leadCount ?? 0,
        createdAt: data.user.createdAt ?? row?.createdAt ?? new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={row ? "Editar usuario" : "Nuevo usuario"}
      subtitle={row?.email}
      icon={<Users className="h-4 w-4" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        {!row && <Field label="Email" type="email" value={email} onChange={setEmail} required />}
        <Field label="Nombre" value={name} onChange={setName} placeholder="Nombre completo" />
        <Field label="Teléfono" value={phone} onChange={setPhone} />
        <Select
          label="Rol"
          value={role}
          onChange={(v) => setRole(v as Role)}
          options={ROLES.map((r) => ({ value: r, label: roleMeta[r].label }))}
        />
        {isSelf && role !== "ADMIN" && (
          <p className="text-xs text-amber-700">No puedes quitarte tu propio rol de admin.</p>
        )}
        <Field
          label={row ? "Nueva contraseña (opcional)" : "Contraseña"}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder={role === "ADMIN" ? "Requerida para admin" : "Solo si necesita login"}
          hint="Mínimo 8 caracteres. Necesaria para cuentas ADMIN."
        />
        <FormError error={error} />
        <ModalActions onCancel={onClose} busy={busy} submitLabel={row ? "Guardar" : "Crear usuario"} />
      </form>
    </Modal>
  );
}
