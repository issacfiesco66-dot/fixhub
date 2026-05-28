import { NextRequest, NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await clearAdminSession();
  } catch (e) {
    // No bloquear logout si la cookie ya estaba mal o algo falla.
    console.error("[admin-logout]", e);
  }
  // Redirect al MISMO host del request (no a NEXT_PUBLIC_APP_URL que podría
  // ser un alias distinto al que el usuario está usando — eso causaba 500).
  // 303 See Other es el código correcto para POST → GET redirect.
  return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin), {
    status: 303,
  });
}
