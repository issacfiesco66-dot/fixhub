"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

const faqs = [
  {
    q: "¿Cuánto cuesta solicitar un servicio?",
    a: "Para los clientes es totalmente gratis solicitar un técnico. Solo pagas directamente al profesional el costo del servicio que acordaron, sin comisiones ocultas de FixHub.",
  },
  {
    q: "¿Cómo verifican a los técnicos?",
    a: "Cada técnico pasa por un proceso de validación de identidad y experiencia antes de poder recibir leads. Verificamos identificación oficial, comprobante de domicilio y referencias profesionales. Adicionalmente monitoreamos calificaciones de clientes en tiempo real.",
  },
  {
    q: "¿Qué pasa si el técnico no llega o el servicio no me convence?",
    a: "Reporta la incidencia inmediatamente a soporte@fixhub.mx. Investigamos cada caso y, si se acredita el incumplimiento, suspendemos al técnico de la red y te canalizamos con otro profesional verificado sin costo adicional.",
  },
  {
    q: "¿En qué ciudades operan?",
    a: "Actualmente cubrimos Guadalajara, Zapopan, Ciudad de México, Querétaro, Puebla y Cuernavaca. Estamos expandiendo continuamente — consulta nuestra sección de cobertura abajo.",
  },
  {
    q: "Soy técnico, ¿cómo me uno?",
    a: "Visita la sección 'Únete como técnico' y completa el registro. Después de verificar tu perfil (usualmente <24 hrs), empezarás a recibir leads en tu zona y especialidad. Solo pagas una pequeña tarifa por cada lead que decidas atender, no hay mensualidades.",
  },
  {
    q: "¿Cómo protegen mis datos personales?",
    a: "Cumplimos con la Ley Federal de Protección de Datos Personales (LFPDPPP). Tu información se cifra en tránsito y en reposo, y solo se comparte con el técnico que tomó tu solicitud. Lee nuestro Aviso de Privacidad para más detalle.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="mx-auto max-w-3xl px-6 py-20 sm:px-10">
      <div className="mb-10 text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          <HelpCircle className="h-3 w-3" />
          Preguntas frecuentes
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
          Lo que más nos preguntan
        </h2>
      </div>

      <div className="space-y-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className={`overflow-hidden rounded-2xl border bg-white/80 backdrop-blur transition-all ${
                isOpen
                  ? "border-indigo-300 shadow-[0_8px_30px_-10px_rgba(99,102,241,0.25)]"
                  : "border-slate-200/70 hover:border-indigo-200"
              }`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className={`font-medium ${isOpen ? "text-indigo-900" : "text-zinc-800"}`}>
                  {f.q}
                </span>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  className={`shrink-0 ${isOpen ? "text-indigo-600" : "text-zinc-400"}`}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 text-sm leading-relaxed text-zinc-600">{f.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
