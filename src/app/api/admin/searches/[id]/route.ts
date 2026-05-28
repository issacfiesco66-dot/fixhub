// PATCH /api/admin/searches/[id] — actualiza status / notas.
// DELETE /api/admin/searches/[id] — descarta (hard delete, no soft).
//
// Cuando el admin "promueve" una búsqueda → crea el Service en /admin/seo
// y manualmente marca esta búsqueda como LAUNCHED. La UI puede automatizar
// el doble paso después.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    status: z.enum(["PENDING", "RESEARCHING", "LAUNCHED", "DISCARDED"]).optional(),
    adminNotes: z.string().max(2000).optional(),
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

  const updated = await prisma.serviceSearch.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ ok: true, search: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.serviceSearch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
