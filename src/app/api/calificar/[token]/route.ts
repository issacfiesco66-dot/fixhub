// POST /api/calificar/[token] — el cliente envía su calificación (público, sin
// login). El token es de un solo uso (submittedAt lo bloquea). Al registrar,
// recalcula el rating promedio y el total de trabajos del técnico.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    rating: z.number().int().min(1).max(5),
    hadIssue: z.boolean().default(false),
    comment: z.string().max(800).optional().or(z.literal("")),
  })
  .strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const ip = getClientIp(req);
  const rl = rateLimit(`review:${ip}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { token } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }

  const review = await prisma.review.findUnique({ where: { token } });
  if (!review) return NextResponse.json({ error: "Enlace de calificación inválido" }, { status: 404 });
  if (review.submittedAt) {
    return NextResponse.json({ error: "Esta calificación ya fue registrada" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: review.id },
      data: {
        rating: parsed.data.rating,
        hadIssue: parsed.data.hadIssue,
        comment: parsed.data.comment || null,
        submittedAt: new Date(),
      },
    });

    // Recalcular rating promedio + total de trabajos calificados del técnico.
    const rated = await tx.review.findMany({
      where: { technicianId: review.technicianId, submittedAt: { not: null }, rating: { not: null } },
      select: { rating: true },
    });
    const sum = rated.reduce((acc, r) => acc + (r.rating ?? 0), 0);
    const avg = rated.length > 0 ? sum / rated.length : 0;
    await tx.technician.update({
      where: { id: review.technicianId },
      data: { rating: avg, totalJobs: rated.length },
    });
  });

  return NextResponse.json({ ok: true });
}
