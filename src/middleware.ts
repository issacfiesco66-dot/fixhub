import { NextResponse, type NextRequest } from "next/server";

// CSRF protection vía Origin/Referer validation.
// Para POST/PATCH/PUT/DELETE en /api/*, el header Origin debe matchear
// nuestro APP_URL. Esto cierra C-5 del audit — sin esta capa, un sitio
// malicioso podía forzar al admin (con cookies activas) a hacer ops costosas
// (ej. spammear /api/admin/seo/generate y quemar tokens de OpenAI).
//
// Exenciones:
//   - GET/HEAD/OPTIONS: read-only, no necesitan CSRF
//   - /api/billing/webhook: Stripe-signed con HMAC, no manda Origin

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const STRIPE_WEBHOOK_PATH = "/api/billing/webhook";

function getAllowedOrigins(): Set<string> {
  const set = new Set<string>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) set.add(appUrl.replace(/\/$/, ""));
  // Permitir dev local y URLs preview de Vercel automáticamente
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) set.add(`https://${vercelUrl}`);
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

  const allowed = getAllowedOrigins();
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  let ok = false;
  if (origin && allowed.has(origin)) ok = true;
  if (!ok && referer) {
    for (const o of allowed) {
      if (referer.startsWith(o + "/") || referer === o) {
        ok = true;
        break;
      }
    }
  }

  if (!ok) {
    return NextResponse.json(
      { error: "CSRF check failed: invalid origin" },
      { status: 403 }
    );
  }
  return NextResponse.next();
}

export const config = {
  // Solo corre el middleware en /api/* (lo demás es páginas/assets)
  matcher: ["/api/:path*"],
};
