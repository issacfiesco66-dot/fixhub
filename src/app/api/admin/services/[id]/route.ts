// PATCH /api/admin/services/[id] — edita campos + re-sincroniza marcas.
// DELETE /api/admin/services/[id] — borra. Si tiene leads/técnicos asociados,
// el FK lo impide → respondemos 409 sugiriendo desactivar.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { serviceUpdateSchema } from "@/lib/validators";
import { ensureUniqueSlug, isForeignKeyError, isUniqueError } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = serviceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const existing = await prisma.service.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!existing) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });

  // Resolver slug si cambió el nombre o se pasó uno explícito
  let slug: string | undefined;
  if (d.slug !== undefined || d.name !== undefined) {
    const desired = d.slug ?? undefined;
    const nameForSlug = d.name ?? "";
    if (desired || nameForSlug) {
      slug = await ensureUniqueSlug(nameForSlug, desired, async (s) => {
        if (s === existing.slug) return false; // su propio slug no cuenta
        const found = await prisma.service.findUnique({ where: { slug: s }, select: { id: true } });
        return !!found;
      });
    }
  }

  try {
    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(slug ? { slug } : {}),
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.description !== undefined ? { description: d.description || null } : {}),
        ...(d.categoryId !== undefined ? { categoryId: d.categoryId } : {}),
        ...(d.requiresBrand !== undefined ? { requiresBrand: d.requiresBrand } : {}),
        ...(d.basePrice !== undefined ? { basePrice: d.basePrice } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
        // Re-sincronizar marcas: borrar todas y recrear (set completo)
        ...(d.brandIds !== undefined
          ? {
              brands: {
                deleteMany: {},
                create: d.brandIds.map((brandId) => ({ brandId })),
              },
            }
          : {}),
      },
    });
    return NextResponse.json({ ok: true, service });
  } catch (e) {
    if (isUniqueError(e)) {
      return NextResponse.json({ error: "Ya existe un servicio con ese slug" }, { status: 409 });
    }
    console.error("[api/admin/services PATCH]", e);
    return NextResponse.json({ error: "Error al actualizar el servicio" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    // ServiceBrand y ServiceContent tienen onDelete: Cascade — se van solos.
    // Lead y TechnicianService NO → si existen, el FK bloquea el borrado.
    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isForeignKeyError(e)) {
      return NextResponse.json(
        {
          error:
            "Este servicio tiene leads o técnicos asociados. Desactívalo en lugar de borrarlo para no perder el historial.",
        },
        { status: 409 }
      );
    }
    console.error("[api/admin/services DELETE]", e);
    return NextResponse.json({ error: "Error al borrar el servicio" }, { status: 500 });
  }
}
