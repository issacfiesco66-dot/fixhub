import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { cityUpdateSchema } from "@/lib/validators";
import { ensureUniqueSlug, isForeignKeyError, isUniqueError } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = cityUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await prisma.city.findUnique({ where: { id }, select: { slug: true } });
  if (!existing) return NextResponse.json({ error: "Ciudad no encontrada" }, { status: 404 });

  let slug: string | undefined;
  if (d.slug !== undefined || d.name !== undefined) {
    slug = await ensureUniqueSlug(d.name ?? "", d.slug ?? undefined, async (s) => {
      if (s === existing.slug) return false;
      const found = await prisma.city.findUnique({ where: { slug: s }, select: { id: true } });
      return !!found;
    });
  }

  try {
    const city = await prisma.city.update({
      where: { id },
      data: {
        ...(slug ? { slug } : {}),
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.stateId !== undefined ? { stateId: d.stateId } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
        ...(d.latitude !== undefined ? { latitude: d.latitude } : {}),
        ...(d.longitude !== undefined ? { longitude: d.longitude } : {}),
        ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
      },
    });
    return NextResponse.json({ ok: true, city });
  } catch (e) {
    if (isUniqueError(e)) return NextResponse.json({ error: "Slug duplicado" }, { status: 409 });
    console.error("[api/admin/cities PATCH]", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    // coverages y contents tienen cascade. zones y leads NO → bloquean si existen.
    await prisma.city.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isForeignKeyError(e)) {
      return NextResponse.json(
        { error: "Esta ciudad tiene zonas o leads asociados. Desactívala en lugar de borrarla." },
        { status: 409 }
      );
    }
    console.error("[api/admin/cities DELETE]", e);
    return NextResponse.json({ error: "Error al borrar" }, { status: 500 });
  }
}
