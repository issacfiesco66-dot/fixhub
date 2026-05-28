"use client";

// Primitivos compartidos por las pestañas del catálogo: Modal, Field, Toggle, etc.

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { BentoIcon } from "@/components/ui/BentoCard";

export function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.12)] backdrop-blur-xl"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-5 flex items-center gap-3">
          <BentoIcon tone="indigo">{icon}</BentoIcon>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
          </div>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
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
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
      />
      {hint && <span className="mt-1 block text-[10px] text-zinc-400">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
      />
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
        checked
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-zinc-500"
      }`}
    >
      <span
        className={`relative h-4 w-7 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-zinc-300"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${checked ? "left-3.5" : "left-0.5"}`}
        />
      </span>
      {label}
    </button>
  );
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </div>
  );
}

export function ModalActions({
  onCancel,
  busy,
  submitLabel = "Guardar",
}: {
  onCancel: () => void;
  busy: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="flex gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-zinc-500 hover:bg-slate-100/60"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={busy}
        className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50"
      >
        {busy ? "Guardando…" : submitLabel}
      </button>
    </div>
  );
}
