// Rate limiter sliding-window in-memory.
//
// Cierra parcialmente H-1, H-2, H-4 del audit (defer Upstash/Redis para fase 2).
//
// ⚠️ LIMITACIÓN: Vercel serverless = cada instance tiene su propio Map.
// Un atacante distribuido o un cold start frecuente puede saltar el límite.
// Para producción seria reemplazar el body de check() por Upstash Redis
// INCR + EXPIRE (la API pública queda igual). El interface y los call sites
// no cambian.

type Bucket = number[]; // timestamps en ms

const globalForLimiter = globalThis as unknown as { __ratelimit_buckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = globalForLimiter.__ratelimit_buckets ?? new Map();
if (process.env.NODE_ENV !== "production") globalForLimiter.__ratelimit_buckets = buckets;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

/**
 * Check sliding window. Devuelve { allowed, remaining, resetMs }.
 *
 * @param key bucket id — usa "ip:endpoint" o "user:endpoint"
 * @param limit max requests permitidas en la ventana
 * @param windowMs duración de la ventana
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  let bucket = buckets.get(key) ?? [];
  // Purgar timestamps fuera de la ventana
  bucket = bucket.filter((t) => t > cutoff);

  if (bucket.length >= limit) {
    const oldest = bucket[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldest + windowMs - now,
    };
  }

  bucket.push(now);
  buckets.set(key, bucket);

  return {
    allowed: true,
    remaining: limit - bucket.length,
    resetMs: windowMs,
  };
}

/**
 * Extrae IP del request honrando x-forwarded-for (Vercel proxy).
 * Fallback a "anon" si no hay headers (testing local).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "anon";
}

/**
 * Helper para devolver 429 con headers estándar cuando se excede el límite.
 */
export function rateLimitResponse(result: RateLimitResult) {
  const seconds = Math.ceil(result.resetMs / 1000);
  return Response.json(
    { error: "Demasiadas solicitudes. Intenta de nuevo en breve.", retryAfter: seconds },
    {
      status: 429,
      headers: {
        "Retry-After": String(seconds),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil((Date.now() + result.resetMs) / 1000)),
      },
    }
  );
}
