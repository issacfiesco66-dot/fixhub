// POST /api/leads/[id]/diagnosis — asistente de diagnóstico IA.
//
// Solo el técnico que COMPRÓ el lead puede pedirlo. El resultado se cachea en
// LeadPurchase.diagnosis para no regenerar ni gastar tokens dos veces; el
// técnico puede forzar regenerar con { regenerate: true }.

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTechnician } from "@/lib/auth";
import { generateRepairDiagnosis } from "@/lib/ai-diagnosis";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tech = await getCurrentTechnician();
  if (!tech) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Generar con IA cuesta tokens → límite por técnico.
  const rl = await rateLimit(`diagnosis:${tech.id}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { id: leadId } = await params;
  const body = await req.json().catch(() => ({}));
  const regenerate = body?.regenerate === true;

  // El técnico debe ser dueño de la compra de este lead
  const purchase = await prisma.leadPurchase.findUnique({
    where: { leadId },
    include: { lead: { include: { service: true, brand: true } } },
  });
  if (!purchase || purchase.technicianId !== tech.id) {
    return NextResponse.json({ error: "No tienes acceso a este lead" }, { status: 403 });
  }

  // Si ya existe y no se pide regenerar → devolver el cacheado
  if (purchase.diagnosis && !regenerate) {
    return NextResponse.json({ diagnosis: purchase.diagnosis, cached: true });
  }

  let diagnosis;
  try {
    diagnosis = await generateRepairDiagnosis({
      serviceName: purchase.lead.service.name,
      brandName: purchase.lead.brand?.name ?? null,
      problem: purchase.lead.failure,
    });
  } catch (e) {
    console.error("[diagnosis] generación falló:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "No se pudo generar el diagnóstico. Intenta de nuevo en un momento." },
      { status: 502 }
    );
  }

  await prisma.leadPurchase.update({
    where: { id: purchase.id },
    data: {
      diagnosis: diagnosis as unknown as Prisma.InputJsonValue,
      diagnosisAt: new Date(),
    },
  });

  return NextResponse.json({ diagnosis, cached: false });
}
