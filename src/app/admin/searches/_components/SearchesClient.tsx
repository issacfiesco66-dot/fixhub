"use client";

import { useMemo, useState } from "react";
import {
  SearchCheck,
  Search,
  Filter,
  MapPin,
  Mail,
  Phone,
  TrendingUp,
  CheckCircle2,
  Trash2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";

type Search = {
  id: string;
  rawQuery: string;
  normalizedQuery: string;
  citySlug: string | null;
  hasMatch: boolean;
  count: number;
  email: string | null;
  phone: string | null;
  status: "PENDING" | "RESEARCHING" | "LAUNCHED" | "DISCARDED";
  adminNotes: string | null;
  source: string | null;
  matchedService: { slug: string; name: string } | null;
  createdAt: string;
  lastSeenAt: string;
};

type City = { slug: string; name: string };

const STATUSES: Search["status"][] = ["PENDING", "RESEARCHING", "LAUNCHED", "DISCARDED"];

const statusMeta: Record<Search["status"], { label: string; cls: string; dot: string }> = {
  PENDING: { label: "Pendiente", cls: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20", dot: "bg-indigo-400" },
  RESEARCHING: { label: "Investigando", cls: "bg-amber-500/10 text-amber-700 ring-amber-500/30", dot: "bg-amber-400" },
  LAUNCHED: { label: "Lanzado", cls: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20", dot: "bg-emerald-500" },
  DISCARDED: { label: "Descartado", cls: "bg-zinc-100 text-zinc-500 ring-zinc-200", dot: "bg-zinc-500" },
};

type MatchFilter = "ALL" | "MISS" | "HIT";

export function SearchesClient({ initial, cities }: { initial: Search[]; cities: City[] }) {
  const [items, setItems] = useState<Search[]>(initial);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Search["status"] | "ALL">("ALL");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("MISS");
  const [cityFilter, setCityFilter] = useState<string>("ALL");

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      ALL: items.length,
      PENDING: 0,
      RESEARCHING: 0,
      LAUNCHED: 0,
      DISCARDED: 0,
      MISS: 0,
      HIT: 0,
    };
    for (const s of items) {
      map[s.status]++;
      if (s.hasMatch) map.HIT++;
      else map.MISS++;
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (matchFilter === "MISS" && s.hasMatch) return false;
      if (matchFilter === "HIT" && !s.hasMatch) return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (cityFilter !== "ALL") {
        const wantsEmpty = cityFilter === "";
        if (wantsEmpty && s.citySlug) return false;
        if (!wantsEmpty && s.citySlug !== cityFilter) return false;
      }
      if (q && !s.rawQuery.toLowerCase().includes(q) && !s.normalizedQuery.includes(q)) {
        return false;
      }
      return true;
    });
  }, [items, search, statusFilter, matchFilter, cityFilter]);

  // Totales útiles para el header
  const totalMisses = counts.MISS;
  const totalHits = counts.HIT;
  const topMiss = useMemo(() => items.filter((i) => !i.hasMatch).slice(0, 1)[0], [items]);

  async function changeStatus(id: string, status: Search["status"]) {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    await fetch(`/api/admin/searches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function deleteOne(id: string) {
    if (!confirm("¿Eliminar esta búsqueda? Esta acción no se puede deshacer.")) return;
    setItems((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/admin/searches/${id}`, { method: "DELETE" });
  }

  const cityNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cities) map.set(c.slug, c.name);
    return map;
  }, [cities]);

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <SearchCheck className="h-7 w-7 text-indigo-600" />
            Búsquedas
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Qué servicios buscan los visitantes. Las queries sin match son tu próximo
            catálogo a sumar.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <BentoCard className="p-5">
          <div className="flex items-center gap-3">
            <BentoIcon tone="red">
              <AlertCircle className="h-4 w-4" />
            </BentoIcon>
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500">Sin match</div>
              <div className="text-2xl font-bold tabular-nums text-zinc-900">{totalMisses}</div>
            </div>
          </div>
          {topMiss && (
            <div className="mt-3 truncate text-xs text-zinc-500">
              Top: <span className="font-medium text-zinc-700">{topMiss.rawQuery}</span> ({topMiss.count}×)
            </div>
          )}
        </BentoCard>
        <BentoCard className="p-5">
          <div className="flex items-center gap-3">
            <BentoIcon tone="emerald">
              <CheckCircle2 className="h-4 w-4" />
            </BentoIcon>
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500">Con match</div>
              <div className="text-2xl font-bold tabular-nums text-zinc-900">{totalHits}</div>
            </div>
          </div>
        </BentoCard>
        <BentoCard className="p-5">
          <div className="flex items-center gap-3">
            <BentoIcon tone="indigo">
              <TrendingUp className="h-4 w-4" />
            </BentoIcon>
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500">Total</div>
              <div className="text-2xl font-bold tabular-nums text-zinc-900">{items.length}</div>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Filtros principales */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Match</span>
        {(["MISS", "HIT", "ALL"] as MatchFilter[]).map((f) => {
          const active = matchFilter === f;
          const label = f === "MISS" ? "Sin match" : f === "HIT" ? "Con match" : "Todas";
          return (
            <button
              key={f}
              onClick={() => setMatchFilter(f)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-700"
                  : "border-slate-200 bg-white/60 text-zinc-500 hover:bg-white"
              }`}
            >
              {label}
              <span className="rounded-full bg-slate-100/80 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-700">
                {counts[f]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros secundarios */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Estado</span>
        {(["ALL", ...STATUSES] as const).map((s) => {
          const active = statusFilter === s;
          const meta = s === "ALL" ? null : statusMeta[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
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

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-zinc-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">Todas las ciudades</option>
            <option value="">Sin ciudad</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar query…"
              className="w-56 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Lista */}
      <BentoCard className="overflow-hidden">
        <div className="divide-y divide-slate-200/80">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              <Filter className="mx-auto mb-2 h-5 w-5" />
              Sin resultados con estos filtros.
            </div>
          ) : (
            filtered.map((s) => (
              <SearchRow
                key={s.id}
                row={s}
                cityName={s.citySlug ? cityNameBySlug.get(s.citySlug) ?? s.citySlug : null}
                onChangeStatus={changeStatus}
                onDelete={deleteOne}
              />
            ))
          )}
        </div>
      </BentoCard>
    </div>
  );
}

function SearchRow({
  row,
  cityName,
  onChangeStatus,
  onDelete,
}: {
  row: Search;
  cityName: string | null;
  onChangeStatus: (id: string, status: Search["status"]) => void;
  onDelete: (id: string) => void;
}) {
  const meta = statusMeta[row.status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50/60">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <BentoIcon tone={row.hasMatch ? "emerald" : "amber"}>
          {row.hasMatch ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        </BentoIcon>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold text-zinc-900">{row.rawQuery}</div>
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-indigo-700 ring-1 ring-indigo-500/20">
              {row.count}×
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${meta.cls}`}>
              <span className={`h-1 w-1 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
            {row.matchedService && (
              <Link
                href={`/${row.matchedService.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20"
              >
                → {row.matchedService.name}
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {cityName ?? "Sin ciudad"}
            </span>
            {row.email && (
              <a href={`mailto:${row.email}`} className="flex items-center gap-1 hover:text-indigo-600">
                <Mail className="h-3 w-3" />
                {row.email}
              </a>
            )}
            {row.phone && (
              <a href={`tel:${row.phone.replace(/\D/g, "")}`} className="flex items-center gap-1 hover:text-indigo-600">
                <Phone className="h-3 w-3" />
                {row.phone}
              </a>
            )}
            {row.source && (
              <span className="rounded-full bg-slate-100/80 px-2 py-0.5 text-[10px]">{row.source}</span>
            )}
            <span className="text-[10px] text-zinc-400">
              Última vez: {new Date(row.lastSeenAt).toLocaleString("es-MX")}
            </span>
          </div>
          {row.adminNotes && (
            <div className="mt-1.5 text-xs italic text-zinc-500">&ldquo;{row.adminNotes}&rdquo;</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={row.status}
          onChange={(e) => onChangeStatus(row.id, e.target.value as Search["status"])}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusMeta[s].label}
            </option>
          ))}
        </select>
        {!row.hasMatch && row.status === "PENDING" && (
          <Link
            href="/admin/seo"
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
            title="Crear este servicio en el catálogo"
          >
            Promover →
          </Link>
        )}
        <button
          onClick={() => onDelete(row.id)}
          className="rounded-lg border border-slate-200 bg-white p-2 text-red-400 hover:bg-red-50"
          title="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
