import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { brandUpdateSchema } from "@/lib/validators";
import { ensureUniqueSlug, isForeignKeyError, isUniqueError } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = brandUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await prisma.brand.findUnique({ where: { id }, select: { slug: true } });
  if (!existing) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  let slug: string | undefined;
  if (d.slug !== undefined || d.name !== undefined) {
    slug = await ensureUniqueSlug(d.name ?? "", d.slug ?? undefined, async (s) => {
      if (s === existing.slug) return false;
      const found = await prisma.brand.findUnique({ where: { slug: s }, select: { id: true } });
      return !!found;
    });
  }

  try {
    const brand = await prisma.brand.update({
      where: { id },
      data: {
        ...(slug ? { slug } : {}),
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.logo !== undefined ? { logo: d.logo || null } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
      },
    });
    return NextResponse.json({ ok: true, brand });
  } catch (e) {
    if (isUniqueError(e)) return NextResponse.json({ error: "Slug duplicado" }, { status: 409 });
    console.error("[api/admin/brands PATCH]", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    // ServiceBrand se borra en cascade. Lead.brandId (opcional) NO → si hay
    // leads con esta marca, el FK bloquea.
    await prisma.brand.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isForeignKeyError(e)) {
      return NextResponse.json(
        { error: "Esta marca tiene leads asociados. Desactívala en lugar de borrarla." },
        { status: 409 }
      );
    }
    console.error("[api/admin/brands DELETE]", e);
    return NextResponse.json({ error: "Error al borrar" }, { status: 500 });
  }
}
