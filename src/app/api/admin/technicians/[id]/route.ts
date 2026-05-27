import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    verified: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .strict();

// PATCH /api/admin/technicians/:id — admin verifica/desverifica/activa/desactiva
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const tech = await prisma.technician.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ ok: true, technician: tech });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("[api/admin/technicians/:id]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
