// Rate limiter con Upstash Redis (sliding window) + fallback in-memory.
//
// En producción serverless (Vercel) el rate limit DEBE vivir en un store
// compartido — un Map in-memory tiene un bucket por instancia/cold-start y no
// frena fuerza bruta real. Si están configuradas UPSTASH_REDIS_REST_URL +
// UPSTASH_REDIS_REST_TOKEN, usamos Upstash (compartido entre todas las lambdas).
// Si NO, caemos al Map in-memory (suficiente en dev; en prod degradado pero
// nunca rompe la app).
//
// rateLimit() es async — todos los call sites deben usar `await`.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

// ── Upstash (compartido) ────────────────────────────────────────────
let redis: Redis | null | undefined; // undefined = sin inicializar, null = no configurado
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

// Cache de limiters por (limit, ventana) para no recrearlos en cada request.
const limiters = new Map<string, Ratelimit>();
function getLimiter(limit: number, windowSec: number): Ratelimit {
  const cacheKey = `${limit}:${windowSec}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis()!,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: "fixhub-rl",
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

// ── Fallback in-memory ──────────────────────────────────────────────
type Bucket = number[];
const globalForLimiter = globalThis as unknown as { __ratelimit_buckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = globalForLimiter.__ratelimit_buckets ?? new Map();
if (process.env.NODE_ENV !== "production") globalForLimiter.__ratelimit_buckets = buckets;

function inMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  let bucket = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (bucket.length >= limit) {
    return { allowed: false, remaining: 0, resetMs: bucket[0] + windowMs - now };
  }
  bucket.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.length, resetMs: windowMs };
}

/**
 * Sliding-window rate limit. Usa Upstash si está configurado, si no in-memory.
 *
 * @param key      bucket id — "ip:endpoint" o "user:endpoint"
 * @param limit    máximo de requests en la ventana
 * @param windowMs duración de la ventana en ms
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (getRedis()) {
    try {
      const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
      const res = await getLimiter(limit, windowSec).limit(key);
      return {
        allowed: res.success,
        remaining: res.remaining,
        resetMs: Math.max(0, res.reset - Date.now()),
      };
    } catch (e) {
      // Si Upstash falla (red/credenciales), degradar a in-memory en vez de
      // tumbar el endpoint.
      console.error("[rate-limit] Upstash falló, usando in-memory:", e instanceof Error ? e.message : e);
    }
  }
  return inMemory(key, limit, windowMs);
}

/**
 * Extrae IP del request. En Vercel, `x-forwarded-for` lo controla el proxy;
 * tomamos el PRIMER hop (el cliente real). `x-real-ip` como respaldo.
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
