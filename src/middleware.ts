import { NextResponse, type NextRequest } from "next/server";

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
// Exenciones:
//   - GET/HEAD/OPTIONS: read-only, no necesitan CSRF
//   - /api/billing/webhook: Stripe-signed con HMAC, no manda Origin

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const STRIPE_WEBHOOK_PATH = "/api/billing/webhook";

function getExtraAllowedOrigins(): Set<string> {
  const set = new Set<string>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) set.add(appUrl.replace(/\/$/, ""));
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
  if (nextUrl.pathname === STRIPE_WEBHOOK_PATH) return NextResponse.next();

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
