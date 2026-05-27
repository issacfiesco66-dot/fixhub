// Broker de realtime en memoria — pub/sub por canal (cityId:serviceId).
// Diseñado para SSE en una sola instancia. Para producción multi-instancia,
// reemplaza el cuerpo de publish() por una llamada a Pusher/Ably/Supabase Realtime,
// y reemplaza subscribe() por el cliente correspondiente. La API pública
// (subscribe/publish/channelOf) NO cambia, así que el resto del código queda igual.

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
  viewersHint: number; // mentira piadosa para el FOMO
  expiresAt: string;
  createdAt: string;
};

type Subscriber = (msg: LeadAlertPayload) => void;

class Broker {
  private channels = new Map<string, Set<Subscriber>>();

  channelOf(cityId: string, serviceId: string) {
    return `${cityId}:${serviceId}`;
  }

  // Suscribe a múltiples canales a la vez (un técnico cubre N ciudades × M servicios)
  subscribe(channels: string[], sub: Subscriber): () => void {
    for (const ch of channels) {
      if (!this.channels.has(ch)) this.channels.set(ch, new Set());
      this.channels.get(ch)!.add(sub);
    }
    return () => {
      for (const ch of channels) {
        this.channels.get(ch)?.delete(sub);
      }
    };
  }

  publish(channel: string, msg: LeadAlertPayload) {
    const subs = this.channels.get(channel);
    if (!subs) return 0;
    for (const sub of subs) {
      try {
        sub(msg);
      } catch (e) {
        // un consumidor caído no debe tumbar al resto
        console.error("[realtime] subscriber error", e);
      }
    }
    return subs.size;
  }

  // Estimado de "técnicos viendo" para el FOMO (suma de subs en canales)
  viewerCount(channel: string) {
    return this.channels.get(channel)?.size ?? 0;
  }
}

// Singleton entre hot-reloads de Next dev
const globalForBroker = globalThis as unknown as { __fixhub_broker?: Broker };
export const broker = globalForBroker.__fixhub_broker ?? new Broker();
if (process.env.NODE_ENV !== "production") globalForBroker.__fixhub_broker = broker;
