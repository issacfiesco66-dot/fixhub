// Base URL pública del sitio — SIEMPRE validada como URL http(s).
//
// Defensa en profundidad: si NEXT_PUBLIC_APP_URL quedara mal configurada
// (p. ej. un secreto pegado por error en esa variable de entorno), este helper
// NUNCA devuelve ese valor crudo — lo descarta por no ser una URL válida y cae
// a un fallback seguro. Así jamás se publica un secreto en sitemap.xml,
// robots.txt, JSON-LD, links de email, etc.
//
// Orden de preferencia:
//   1. NEXT_PUBLIC_APP_URL          (intención explícita del operador)
//   2. VERCEL_PROJECT_PRODUCTION_URL (dominio canónico de producción en Vercel)
//   3. VERCEL_URL                    (dominio del deployment actual)
//   4. http://localhost:3000         (último recurso, dev)
//
// Edge-safe: solo usa `URL` y `process.env`.

function isHttpUrl(value: string | undefined | null): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function getPublicBaseUrl(): string {
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const vercelNow = process.env.VERCEL_URL;

  const candidates: (string | undefined)[] = [
    process.env.NEXT_PUBLIC_APP_URL,
    vercelProd ? `https://${vercelProd}` : undefined,
    vercelNow ? `https://${vercelNow}` : undefined,
  ];

  for (const candidate of candidates) {
    if (isHttpUrl(candidate)) return candidate.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}
