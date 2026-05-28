import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { categoryCreateSchema } from "@/lib/validators";
import { ensureUniqueSlug, isUniqueError } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { services: true } } },
  });
  return NextResponse.json({
    categories: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      icon: c.icon,
      order: c.order,
      active: c.active,
      serviceCount: c._count.services,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = categoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const slug = await ensureUniqueSlug(d.name, d.slug, async (s) => {
    const found = await prisma.category.findUnique({ where: { slug: s }, select: { id: true } });
    return !!found;
  });

  try {
    const category = await prisma.category.create({
      data: {
        slug,
        name: d.name,
        description: d.description || null,
        icon: d.icon || null,
        order: d.order,
        active: d.active,
      },
    });
    return NextResponse.json({ ok: true, category }, { status: 201 });
  } catch (e) {
    if (isUniqueError(e)) return NextResponse.json({ error: "Slug duplicado" }, { status: 409 });
    console.error("[api/admin/categories POST]", e);
    return NextResponse.json({ error: "Error al crear la categoría" }, { status: 500 });
  }
}
