import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/catalog — público (no auth)
// Devuelve ciudades + servicios activos para llenar el form de registro de técnico.
// Solo expone slug + name, nada sensible.
export async function GET() {
  try {
    const [cities, services] = await Promise.all([
      prisma.city.findMany({
        where: { active: true },
        select: { slug: true, name: true, state: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.service.findMany({
        where: { active: true },
        select: {
          slug: true,
          name: true,
          basePrice: true,
          category: { select: { slug: true, name: true } },
        },
        orderBy: [{ category: { order: "asc" } }, { name: "asc" }],
      }),
    ]);

    return NextResponse.json({
      cities: cities.map((c) => ({
        slug: c.slug,
        name: c.name,
        state: c.state.name,
      })),
      services: services.map((s) => ({
        slug: s.slug,
        name: s.name,
        basePrice: s.basePrice,
        category: s.category,
      })),
    });
  } catch (e) {
    console.error("[api/catalog]", e);
    return NextResponse.json({ cities: [], services: [] });
  }
}
