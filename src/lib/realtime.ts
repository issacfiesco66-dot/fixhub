// Realtime layer — actualmente vía polling (Vercel-compatible).
//
// El dashboard del técnico llama GET /api/leads/feed?since= cada 5s.
// La API valida coverage server-side y devuelve solo los leads nuevos
// en su zona/servicios.
//
// Si en el futuro mueves a un host con conexiones persistentes (Railway,
// Fly.io, etc.) o agregas Pusher/Ably/Upstash Redis pub/sub, esta capa
// existe como punto de extensión. Por ahora el feed va por polling y
// las páginas que importaban `broker` ya no lo necesitan.

export type LeadAlertPayload = {
  type: "NEW_LEAD";
  leadId: string;
  service: string;
  serviceSlug: string;
  brand: string | null;
  city: string;
  zone: string | null;
  failure: string;
  urgency: "NORMAL" | "URGENT" | "EMERGENCY";
  price: number;
  viewersHint: number;
  expiresAt: string;
  createdAt: string;
};

// "FOMO" sintético — número de técnicos viendo este lead.
// Antes lo sacábamos del broker. Ahora es un número conservador
// hasta que conectemos un contador real (Redis INCR o similar).
export function syntheticViewersHint(): number {
  return 2 + Math.floor(Math.random() * 3); // entre 2 y 4
}
