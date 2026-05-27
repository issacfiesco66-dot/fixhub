import { NextResponse } from "next/server";
import { clearTechnicianSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await clearTechnicianSession();
  return NextResponse.redirect(new URL("/panel/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
}
