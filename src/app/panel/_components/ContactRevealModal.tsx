"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  User,
  X,
  Clock,
} from "lucide-react";

type Props = {
  contact: {
    name: string;
    phone: string;
    email?: string | null;
    addressHint?: string | null;
    service: string;
    city: string;
  };
  onClose: () => void;
};

export function ContactRevealModal({ contact, onClose }: Props) {
  const cleanPhone = contact.phone.replace(/\D/g, "");
  const waText = encodeURIComponent(
    `Hola ${contact.name}, soy técnico de FixHub. Me llegó tu solicitud de ${contact.service}. ¿Cuándo te conviene que pase a revisarlo?`
  );
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${waText}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/70 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-white/90 shadow-2xl backdrop-blur-2xl dark:bg-zinc-900/90"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-black/10 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header verde */}
        <div className="bg-gradient-to-r from-money-500 to-money-600 px-6 py-4">
          <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
            <CheckCircle2 className="h-4 w-4" />
            Lead asegurado
          </div>
        </div>

        <div className="p-6">
          <p className="mb-5 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Contacta a <strong className="text-zinc-900 dark:text-zinc-100">{contact.name}</strong> para{" "}
            <strong className="text-brand-600 dark:text-brand-400">{contact.service}</strong> en{" "}
            {contact.city}.
          </p>

          {/* Tarjeta de datos */}
          <div className="mb-5 space-y-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-800/40">
            <Row icon={<User className="h-4 w-4" />} label="Nombre" value={contact.name} />
            <Row
              icon={<Phone className="h-4 w-4" />}
              label="Teléfono"
              value={contact.phone}
              mono
            />
            {contact.email && (
              <Row
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value={contact.email}
                mono
              />
            )}
            {contact.addressHint && (
              <Row
                icon={<MapPin className="h-4 w-4" />}
                label="Zona"
                value={contact.addressHint}
              />
            )}
          </div>

          {/* CTAs */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <a
              href={`tel:${cleanPhone}`}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Phone className="h-4 w-4" />
              Llamar
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-money-500 to-money-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-money-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </div>

          <div className="mb-3 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
            <Clock className="h-3 w-3" />
            Contacta en los próximos <strong>15 minutos</strong> para máxima conversión
          </div>

          <button
            onClick={onClose}
            className="w-full text-center text-[11px] uppercase tracking-wider text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <span
        className={`text-sm font-medium text-zinc-900 dark:text-zinc-100 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
