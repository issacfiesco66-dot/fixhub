import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { cityCreateSchema } from "@/lib/validators";
import { ensureUniqueSlug, isUniqueError } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cities = await prisma.city.findMany({
    orderBy: { name: "asc" },
    include: {
      state: { select: { id: true, name: true } },
      _count: { select: { leads: true, zones: true, coverages: true } },
    },
  });
  return NextResponse.json({
    cities: cities.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      stateId: c.stateId,
      stateName: c.state.name,
      active: c.active,
      latitude: c.latitude,
      longitude: c.longitude,
      phone: c.phone,
      leadCount: c._count.leads,
      zoneCount: c._count.zones,
      coverageCount: c._count.coverages,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = cityCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const slug = await ensureUniqueSlug(d.name, d.slug, async (s) => {
    const found = await prisma.city.findUnique({ where: { slug: s }, select: { id: true } });
    return !!found;
  });

  try {
    const city = await prisma.city.create({
      data: {
        slug,
        name: d.name,
        stateId: d.stateId,
        active: d.active,
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
        phone: d.phone || null,
      },
    });
    return NextResponse.json({ ok: true, city }, { status: 201 });
  } catch (e) {
    if (isUniqueError(e)) return NextResponse.json({ error: "Slug duplicado" }, { status: 409 });
    console.error("[api/admin/cities POST]", e);
    return NextResponse.json({ error: "Error al crear la ciudad" }, { status: 500 });
  }
}
