import Stripe from "stripe";

// Lazy-init del cliente Stripe — instanciar a nivel de módulo rompe `next build`
// cuando STRIPE_SECRET_KEY no está disponible durante 'Collecting page data'.
// El cliente se crea la primera vez que se usa (en handlers en runtime).
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY no configurado. Añádelo en las env vars del hosting."
    );
  }
  cached = new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
  return cached;
}

// Backward-compat: el resto del código importa `stripe` como objeto.
// Lo exponemos como Proxy que llama a getStripe() en cada acceso.
// Así no rompe imports existentes y mantiene la lazy semántica.
export const stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    const client = getStripe();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop as string];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
