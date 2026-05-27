import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    status: z.enum(["NEW", "CONTACTED", "CONVERTED", "DISCARDED"]).optional(),
    notes: z.string().max(1000).optional(),
    convertedLeadId: z.string().cuid().optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  // Marcar contactedAt automáticamente al pasar a CONTACTED
  if (parsed.data.status === "CONTACTED") {
    const existing = await prisma.prospect.findUnique({ where: { id } });
    if (existing && !existing.contactedAt) data.contactedAt = new Date();
  }

  const prospect = await prisma.prospect.update({ where: { id }, data });
  return NextResponse.json({ ok: true, prospect });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.prospect.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
