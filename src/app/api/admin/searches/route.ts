// GET /api/admin/searches — listado de búsquedas capturadas.
//
// Filtros vía query string:
//   - status: PENDING | RESEARCHING | LAUNCHED | DISCARDED
//   - hasMatch: "true" | "false"
//   - city: citySlug ("" para "sin ciudad")
//   - search: texto libre — busca por rawQuery o normalizedQuery
//
// Ordena por count desc (las queries más populares primero) para que el admin
// vea de un vistazo cuáles servicios son los siguientes a sumar al catálogo.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const hasMatchParam = sp.get("hasMatch");
  const citySlug = sp.get("city");
  const search = sp.get("search");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (hasMatchParam === "true") where.hasMatch = true;
  if (hasMatchParam === "false") where.hasMatch = false;
  if (citySlug !== null) where.citySlug = citySlug;
  if (search) {
    where.OR = [
      { rawQuery: { contains: search, mode: "insensitive" } },
      { normalizedQuery: { contains: search.toLowerCase() } },
    ];
  }

  const searches = await prisma.serviceSearch.findMany({
    where,
    orderBy: [{ count: "desc" }, { lastSeenAt: "desc" }],
    take: 500,
    include: {
      matchedService: { select: { slug: true, name: true } },
    },
  });

  return NextResponse.json({ searches });
}
