"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

/**
 * CTA principal del Hero con micro-interacciones Framer Motion.
 * Se aísla en cliente para no romper el RSC del page.tsx home.
 */
export function HeroCTA({ href = "#servicios", label = "Solicitar técnico ahora" }: { href?: string; label?: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="inline-block"
    >
      <Link
        href={href}
        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 px-9 py-4 text-base font-bold text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/10 transition-shadow hover:shadow-2xl hover:shadow-indigo-500/50"
      >
        {/* Shimmer interno */}
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <span className="relative">{label}</span>
        <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}
