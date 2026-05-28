// GET/PATCH /api/admin/config — configuración global de la app (AppConfig).
// Por ahora: número de leads de cortesía por técnico.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { getFreeLeadsLimit, setFreeLeadsLimit } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ freeLeadsLimit: z.number().int().min(0).max(100) }).strict();

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const freeLeadsLimit = await getFreeLeadsLimit();
  return NextResponse.json({ freeLeadsLimit });
}

export async function PATCH(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }

  await setFreeLeadsLimit(parsed.data.freeLeadsLimit);
  return NextResponse.json({ ok: true, freeLeadsLimit: parsed.data.freeLeadsLimit });
}
