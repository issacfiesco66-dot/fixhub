import { NextResponse, type NextRequest } from "next/server";
import { getPublicBaseUrl } from "@/lib/url";

// CSRF protection vía Origin validation.
//
// Regla principal: si `Origin` del request == origen del propio request
// (mismo host), pasa siempre — es un POST same-origin, por definición no
// es CSRF (un atacante en evil.com no puede inyectar headers Origin del
// dominio víctima).
//
// Adicionalmente permite orígenes externos en la allowed list (útil si
// algún día expones la API a partners). Para MVP solo se acepta same-origin
// + localhost en dev.
//
// Exenciones (máquina-a-máquina autenticadas por secret/firma, no por cookies,
// y que NO envían header Origin porque no son browsers):
//   - GET/HEAD/OPTIONS: read-only, no necesitan CSRF
//   - /api/billing/webhook: Stripe-signed con HMAC
//   - /api/prospectos/ingest: scraper externo con Bearer INGEST_WEBHOOK_SECRET

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const CSRF_EXEMPT_PATHS = new Set(["/api/billing/webhook", "/api/prospectos/ingest"]);

function getExtraAllowedOrigins(): Set<string> {
  const set = new Set<string>();
  // getPublicBaseUrl() valida que sea URL http(s) real — nunca un secreto mal
  // configurado en NEXT_PUBLIC_APP_URL.
  set.add(getPublicBaseUrl());
  if (process.env.NODE_ENV !== "production") {
    set.add("http://localhost:3000");
    set.add("http://127.0.0.1:3000");
  }
  return set;
}

export function middleware(req: NextRequest) {
  const { method, nextUrl } = req;

  if (!MUTATING.has(method)) return NextResponse.next();
  if (!nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  if (CSRF_EXEMPT_PATHS.has(nextUrl.pathname)) return NextResponse.next();

  const origin = req.headers.get("origin");
  // Si no hay Origin (curl o un cliente no-browser que no lo envía), bloqueamos
  // por seguridad. Los browsers SIEMPRE envían Origin en POST cross-origin
  // y cada vez más también en same-origin POST.
  if (!origin) {
    return NextResponse.json(
      { error: "CSRF check failed: missing Origin header" },
      { status: 403 }
    );
  }

  // 1. Same-origin: el origen del request coincide con el host del request.
  //    Vercel siempre sirve HTTPS, pero soportamos http en dev.
  const requestHost = req.headers.get("host");
  if (requestHost) {
    const sameOriginHttps = `https://${requestHost}`;
    const sameOriginHttp = `http://${requestHost}`;
    if (origin === sameOriginHttps || origin === sameOriginHttp) {
      return NextResponse.next();
    }
  }

  // 2. Allowed externos (whitelist)
  const allowed = getExtraAllowedOrigins();
  if (allowed.has(origin)) return NextResponse.next();

  // 3. Cross-origin de un origen no listado — bloquear
  return NextResponse.json(
    { error: "CSRF check failed: invalid origin", origin },
    { status: 403 }
  );
}

export const config = {
  matcher: ["/api/:path*"],
};
