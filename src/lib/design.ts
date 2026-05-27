// Tokens de diseño usados en toda la UI premium.
// Si quieres ajustar el branding, este es el único lugar a tocar.

export const urgencyColors = {
  EMERGENCY: {
    label: "Emergencia",
    icon: "🚨",
    bg: "bg-red-500/10",
    text: "text-red-400",
    ring: "ring-red-500/20",
    gradient: "from-red-500 to-rose-600",
  },
  URGENT: {
    label: "Urgente",
    icon: "⚡",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    ring: "ring-amber-500/20",
    gradient: "from-amber-500 to-orange-500",
  },
  NORMAL: {
    label: "Normal",
    icon: "📋",
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    ring: "ring-indigo-500/20",
    gradient: "from-indigo-500 to-violet-500",
  },
} as const;

// Mapa servicio.slug → icono lucide para selectores tipo card en el form
export const serviceIconMap: Record<string, string> = {
  "reparacion-lavadoras": "WashingMachine",
  "reparacion-refrigeradores": "Refrigerator",
  "reparacion-secadoras": "Shirt",
  "fuga-de-agua": "Droplets",
  "instalacion-electrica": "Zap",
};

// Mapa categoría.slug → icono lucide
export const categoryIconMap: Record<string, string> = {
  "linea-blanca": "WashingMachine",
  "plomeria": "Wrench",
  "electricidad": "Zap",
};
