import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentTechnician } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/leads/feed?since=ISO
// Polling endpoint para el dashboard del técnico — reemplaza el SSE in-memory
// (que no funciona en Vercel serverless). Devuelve leads PENDING en su
// cobertura creados después de `since`.
//
// Seguridad:
//   - Requiere auth de técnico (cookie firmada)
//   - Filtra SIEMPRE por coverages + services del técnico server-side
//     (cierra M-1 del audit: el lead inventory no se expone a anónimos)
//   - El técnico verificado adicionalmente recibe el feed (M-3)
export async function GET(req: NextRequest) {
  const tech = await getCurrentTechnician();
  if (!tech) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!tech.verified) {
    return NextResponse.json(
      { error: "Cuenta pendiente de verificación", leads: [] },
      { status: 403 }
    );
  }

  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 5 * 60 * 1000);
  if (isNaN(since.getTime())) {
    return NextResponse.json({ error: "since inválido" }, { status: 400 });
  }

  const cityIds = tech.coverages.map((c) => c.cityId);
  const serviceIds = tech.services.map((s) => s.serviceId);

  if (cityIds.length === 0 || serviceIds.length === 0) {
    return NextResponse.json({ leads: [], serverTime: new Date().toISOString() });
  }

  const leads = await prisma.lead.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gt: new Date() },
      cityId: { in: cityIds },
      serviceId: { in: serviceIds },
      createdAt: { gt: since },
    },
    select: {
      id: true,
      failure: true,
      urgency: true,
      price: true,
      createdAt: true,
      expiresAt: true,
      addressHint: true,
      service: { select: { name: true, slug: true } },
      brand: { select: { name: true } },
      city: { select: { name: true } },
      zone: { select: { name: true } },
      // clientPhone/Name/Email NUNCA en este feed — solo tras compra
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    leads,
    serverTime: new Date().toISOString(),
    pollIntervalMs: 5000,
  });
}
