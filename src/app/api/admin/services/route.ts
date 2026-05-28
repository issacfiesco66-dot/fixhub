// GET /api/admin/services — lista completa (incluye inactivos) para el admin.
// POST /api/admin/services — crea un servicio + asocia marcas (pivote).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { serviceCreateSchema } from "@/lib/validators";
import { ensureUniqueSlug, isUniqueError } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const services = await prisma.service.findMany({
    orderBy: [{ category: { order: "asc" } }, { name: "asc" }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      brands: { select: { brandId: true } },
      _count: { select: { leads: true, technicians: true } },
    },
  });

  return NextResponse.json({
    services: services.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      categoryId: s.categoryId,
      category: s.category,
      requiresBrand: s.requiresBrand,
      basePrice: s.basePrice,
      active: s.active,
      brandIds: s.brands.map((b) => b.brandId),
      leadCount: s._count.leads,
      technicianCount: s._count.technicians,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = serviceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const slug = await ensureUniqueSlug(d.name, d.slug, async (s) => {
    const found = await prisma.service.findUnique({ where: { slug: s }, select: { id: true } });
    return !!found;
  });

  try {
    const service = await prisma.service.create({
      data: {
        slug,
        name: d.name,
        description: d.description || null,
        categoryId: d.categoryId,
        requiresBrand: d.requiresBrand,
        basePrice: d.basePrice,
        active: d.active,
        brands: d.brandIds?.length
          ? { create: d.brandIds.map((brandId) => ({ brandId })) }
          : undefined,
      },
    });
    return NextResponse.json({ ok: true, service }, { status: 201 });
  } catch (e) {
    if (isUniqueError(e)) {
      return NextResponse.json({ error: "Ya existe un servicio con ese slug" }, { status: 409 });
    }
    console.error("[api/admin/services POST]", e);
    return NextResponse.json({ error: "Error al crear el servicio" }, { status: 500 });
  }
}
