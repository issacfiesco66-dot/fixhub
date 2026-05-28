"use client";

// Buscador del sitio — autocomplete + captura de queries sin match.
//
// Flujo:
//   1. Typing → debounced 250ms → POST /api/search (track=false)
//   2. Muestra dropdown con matches (links a /{service-slug}-{citySlug?})
//   3. Si NO hay matches → CTA "No encontramos X — avísanos" + form email/phone
//   4. Submit del CTA → POST /api/search (track=true) → persiste en ServiceSearch
//
// La separación track=false/true evita inflar la tabla con keystrokes.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight, MapPin, Sparkles, Bell, Check, X, Loader2 } from "lucide-react";

type Match = {
  type: "service" | "category";
  slug: string;
  name: string;
  categoryName?: string;
  score: number;
};

type City = { slug: string; name: string };

type Props = {
  cities: City[];
  placeholder?: string;
};

export function SiteSearch({ cities, placeholder = "¿Qué necesitas reparar o instalar?" }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [citySlug, setCitySlug] = useState<string>("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [captureEmail, setCaptureEmail] = useState("");
  const [capturePhone, setCapturePhone] = useState("");
  const [captureBusy, setCaptureBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cierra dropdown al click fuera
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setShowCapture(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced search (autocomplete)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const value = q.trim();
    if (value.length < 2) {
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: value, citySlug: citySlug || undefined, track: false }),
        });
        const data = await res.json();
        setMatches(data.matches ?? []);
      } catch {
        setMatches([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, citySlug]);

  // Click en match: trackeamos + navegamos
  async function pickMatch(m: Match) {
    void trackSearch({ submitted: true });
    const suffix = citySlug ? `-${citySlug}` : "";
    if (m.type === "service") {
      router.push(`/${m.slug}${suffix}`);
    } else {
      // Para categoría no hay landing dedicada todavía — mandamos a #servicios de la home
      router.push(`/#servicios`);
    }
  }

  // Submit del input (Enter o click "Buscar")
  function submit() {
    const value = q.trim();
    if (value.length < 2) return;
    if (matches.length > 0) {
      // Si hay matches, abrimos el dropdown — el usuario elige
      setOpen(true);
      return;
    }
    // No hay matches → ofrecemos captura
    setShowCapture(true);
    setOpen(false);
    void trackSearch({ submitted: true });
  }

  // POST /api/search con track=true (con o sin email/phone)
  async function trackSearch({
    submitted = false,
    email,
    phone,
  }: { submitted?: boolean; email?: string; phone?: string } = {}) {
    try {
      await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: q.trim(),
          citySlug: citySlug || undefined,
          track: true,
          email,
          phone,
          source: submitted ? "site-search-submit" : "site-search-capture",
        }),
      });
    } catch {
      // best-effort — no rompemos UX si el tracking falla
    }
  }

  // Submit del form de captura
  async function submitCapture(e: React.FormEvent) {
    e.preventDefault();
    if (!captureEmail && !capturePhone) return;
    setCaptureBusy(true);
    await trackSearch({ submitted: true, email: captureEmail, phone: capturePhone });
    setCaptureBusy(false);
    setCaptured(true);
  }

  const hasMatches = matches.length > 0;
  const noResults = q.trim().length >= 2 && !loading && !hasMatches;

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex w-full flex-col gap-2 sm:flex-row"
      >
        {/* Input principal */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setShowCapture(false);
              setCaptured(false);
            }}
            onFocus={() => q.trim().length >= 2 && setOpen(true)}
            placeholder={placeholder}
            className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-zinc-900 placeholder-zinc-400 shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
            aria-label="Buscar servicio"
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-500" />
          )}
        </div>

        {/* Selector de ciudad */}
        {cities.length > 0 && (
          <div className="relative sm:w-48">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <select
              value={citySlug}
              onChange={(e) => setCitySlug(e.target.value)}
              className="h-14 w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-zinc-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
              aria-label="Ciudad"
            >
              <option value="">Todas las ciudades</option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          className="group relative inline-flex h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/40"
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative">Buscar</span>
          <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </form>

      {/* Dropdown de resultados */}
      <AnimatePresence>
        {open && q.trim().length >= 2 && (hasMatches || loading) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-15px_rgba(99,102,241,0.35)]"
          >
            {hasMatches ? (
              <ul className="divide-y divide-slate-100">
                {matches.map((m) => (
                  <li key={`${m.type}-${m.slug}`}>
                    <button
                      type="button"
                      onClick={() => pickMatch(m)}
                      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-indigo-50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-zinc-900">{m.name}</div>
                        {m.categoryName && (
                          <div className="truncate text-xs text-zinc-500">{m.categoryName}</div>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-zinc-400 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-zinc-500">
                <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin text-indigo-500" />
                Buscando…
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA cuando no hay resultados */}
      <AnimatePresence>
        {showCapture && noResults && !captured && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/80 shadow-[0_20px_60px_-15px_rgba(245,158,11,0.35)] backdrop-blur"
          >
            <div className="flex items-start gap-3 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setShowCapture(false)}
                  className="absolute right-3 top-3 rounded-full p-1 text-amber-700/60 hover:bg-amber-100"
                  aria-label="Cerrar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="mb-1 text-sm font-semibold text-amber-900">
                  No encontramos &ldquo;{q.trim()}&rdquo; en nuestro catálogo
                </div>
                <p className="mb-3 text-xs leading-relaxed text-amber-800/80">
                  Estamos sumando técnicos nuevos cada semana. Déjanos tu contacto y te
                  avisamos en cuanto tengamos a alguien disponible.
                </p>
                <form onSubmit={submitCapture} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={captureEmail}
                    onChange={(e) => setCaptureEmail(e.target.value)}
                    placeholder="Tu email"
                    className="h-10 flex-1 rounded-xl border border-amber-200 bg-white px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  <input
                    type="tel"
                    value={capturePhone}
                    onChange={(e) => setCapturePhone(e.target.value)}
                    placeholder="WhatsApp (opcional)"
                    className="h-10 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 sm:w-44"
                  />
                  <button
                    type="submit"
                    disabled={captureBusy || (!captureEmail && !capturePhone)}
                    className="h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-sm font-semibold text-white shadow-md shadow-amber-500/30 transition-all hover:shadow-lg disabled:opacity-50"
                  >
                    {captureBusy ? "Enviando…" : "Avísame"}
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}

        {/* Confirmación */}
        {captured && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/80 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.35)] backdrop-blur"
          >
            <div className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30">
                <Check className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-emerald-900">¡Listo!</div>
                <div className="text-xs text-emerald-800/80">
                  Te avisaremos en cuanto tengamos técnicos para &ldquo;{q.trim()}&rdquo;.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
