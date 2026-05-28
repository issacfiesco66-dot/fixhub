"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";

const COOKIE_NAME = "fixhub_cookie_consent";
const COOKIE_DAYS = 180;

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mostrar solo si no hay consentimiento previo
    const has = document.cookie.split("; ").some((c) => c.startsWith(COOKIE_NAME + "="));
    if (!has) {
      // pequeño delay para que el banner entre con animación post-load
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function accept() {
    const exp = new Date(Date.now() + COOKIE_DAYS * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${COOKIE_NAME}=accepted; expires=${exp}; path=/; SameSite=Lax`;
    setVisible(false);
  }

  function reject() {
    // Aún así guardamos el flag (con valor distinto) para no mostrar el banner
    // repetidamente. Como solo usamos cookies estrictamente necesarias, no
    // hay nada que "des-activar" cuando rechaza — pero le agradecemos saberlo.
    const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${COOKIE_NAME}=rejected; expires=${exp}; path=/; SameSite=Lax`;
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_20px_60px_-15px_rgba(99,102,241,0.3)] backdrop-blur-md sm:p-5"
          role="region"
          aria-label="Aviso de uso de cookies"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20">
              <Cookie className="h-4 w-4" />
            </div>

            <div className="flex-1 text-sm">
              <p className="text-zinc-700">
                Usamos cookies estrictamente necesarias para mantener tu sesión y
                proteger tu cuenta. No usamos cookies de publicidad ni rastreo de
                terceros.{" "}
                <Link href="/cookies" className="font-medium text-indigo-600 hover:text-indigo-700">
                  Más información
                </Link>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={accept}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/30 transition-all hover:shadow-md hover:shadow-indigo-500/40"
                >
                  Aceptar y continuar
                </button>
                <button
                  onClick={reject}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-slate-50"
                >
                  Solo necesarias
                </button>
              </div>
            </div>

            <button
              onClick={reject}
              className="text-zinc-400 hover:text-zinc-600"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
