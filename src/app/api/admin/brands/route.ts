import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { brandCreateSchema } from "@/lib/validators";
import { ensureUniqueSlug, isUniqueError } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { services: true, leads: true } } },
  });
  return NextResponse.json({
    brands: brands.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      logo: b.logo,
      active: b.active,
      serviceCount: b._count.services,
      leadCount: b._count.leads,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = brandCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const slug = await ensureUniqueSlug(d.name, d.slug, async (s) => {
    const found = await prisma.brand.findUnique({ where: { slug: s }, select: { id: true } });
    return !!found;
  });

  try {
    const brand = await prisma.brand.create({
      data: { slug, name: d.name, logo: d.logo || null, active: d.active },
    });
    return NextResponse.json({ ok: true, brand }, { status: 201 });
  } catch (e) {
    if (isUniqueError(e)) return NextResponse.json({ error: "Slug duplicado" }, { status: 409 });
    console.error("[api/admin/brands POST]", e);
    return NextResponse.json({ error: "Error al crear la marca" }, { status: 500 });
  }
}
