import { NextRequest, NextResponse } from "next/server";
import { clearTechnicianSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await clearTechnicianSession();
  } catch (e) {
    console.error("[technician-logout]", e);
  }
  return NextResponse.redirect(new URL("/panel/login", req.nextUrl.origin), {
    status: 303,
  });
}
