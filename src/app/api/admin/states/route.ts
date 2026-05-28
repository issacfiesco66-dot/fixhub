// Estados — soporte para el alta de ciudades (City requiere stateId).
// GET lista, POST crea. No exponemos PATCH/DELETE por ahora (bajo volumen).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { stateCreateSchema } from "@/lib/validators";
import { ensureUniqueSlug, isUniqueError } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const states = await prisma.state.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { cities: true } } },
  });
  return NextResponse.json({
    states: states.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      cityCount: s._count.cities,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = stateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const slug = await ensureUniqueSlug(d.name, d.slug, async (s) => {
    const found = await prisma.state.findUnique({ where: { slug: s }, select: { id: true } });
    return !!found;
  });

  try {
    const state = await prisma.state.create({ data: { slug, name: d.name } });
    return NextResponse.json({ ok: true, state }, { status: 201 });
  } catch (e) {
    if (isUniqueError(e)) return NextResponse.json({ error: "Slug duplicado" }, { status: 409 });
    console.error("[api/admin/states POST]", e);
    return NextResponse.json({ error: "Error al crear el estado" }, { status: 500 });
  }
}
