// POST /api/leads/[id]/complete — el técnico marca el trabajo como completado.
// Crea (idempotente) la Review con un token y dispara el email de calificación
// al cliente. Devuelve el link de calificación para que el técnico también
// pueda compartirlo (ej. por WhatsApp) si el cliente no dejó email.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentTechnician } from "@/lib/auth";
import { getPublicBaseUrl } from "@/lib/url";
import { sendReviewRequestEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tech = await getCurrentTechnician();
  if (!tech) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id: leadId } = await params;

  const purchase = await prisma.leadPurchase.findUnique({
    where: { leadId },
    include: {
      review: true,
      lead: { include: { service: true } },
    },
  });
  if (!purchase || purchase.technicianId !== tech.id) {
    return NextResponse.json({ error: "No tienes acceso a este lead" }, { status: 403 });
  }

  // Idempotente: si ya hay review, reusamos su token; si no, creamos.
  let review = purchase.review;
  if (!review) {
    review = await prisma.review.create({
      data: {
        leadPurchaseId: purchase.id,
        technicianId: tech.id,
        token: randomUUID(),
      },
    });
  }

  if (!purchase.jobCompleted) {
    await prisma.leadPurchase.update({
      where: { id: purchase.id },
      data: { jobCompleted: true },
    });
  }

  const reviewUrl = `${getPublicBaseUrl()}/calificar/${review.token}`;

  // Email best-effort: si el cliente dejó email y la review sigue pendiente.
  let emailed = false;
  if (purchase.lead.clientEmail && !review.submittedAt) {
    try {
      await sendReviewRequestEmail({
        to: purchase.lead.clientEmail,
        reviewUrl,
        technicianName: tech.displayName,
        serviceName: purchase.lead.service.name,
        clientName: purchase.lead.clientName,
      });
      emailed = true;
    } catch (e) {
      console.error("[complete] email de review falló:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({
    ok: true,
    alreadyReviewed: !!review.submittedAt,
    reviewUrl,
    emailed,
  });
}
