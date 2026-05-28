// POST /api/leads/[id]/status — el técnico DUEÑO del lead avanza el estado
// operativo del trabajo (para el seguimiento en vivo del cliente):
//   ASSIGNED → ON_THE_WAY → ARRIVED
// El estado COMPLETED se setea por /complete (que además dispara la review).
// Cuando pasa a ON_THE_WAY se le avisa al cliente por email (si dejó correo).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentTechnician } from "@/lib/auth";
import { getPublicBaseUrl } from "@/lib/url";
import { sendClientOnTheWayEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ status: z.enum(["ON_THE_WAY", "ARRIVED"]) }).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tech = await getCurrentTechnician();
  if (!tech) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id: leadId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const purchase = await prisma.leadPurchase.findUnique({
    where: { leadId },
    include: { lead: { include: { service: true } } },
  });
  if (!purchase || purchase.technicianId !== tech.id) {
    return NextResponse.json({ error: "No tienes acceso a este lead" }, { status: 403 });
  }
  if (purchase.jobStatus === "COMPLETED" || purchase.jobStatus === "CANCELLED") {
    return NextResponse.json({ error: "El trabajo ya está cerrado" }, { status: 409 });
  }

  const now = new Date();
  const data: { jobStatus: "ON_THE_WAY" | "ARRIVED"; onTheWayAt?: Date; arrivedAt?: Date } = {
    jobStatus: parsed.data.status,
  };
  if (parsed.data.status === "ON_THE_WAY") data.onTheWayAt = now;
  if (parsed.data.status === "ARRIVED") data.arrivedAt = now;

  await prisma.leadPurchase.update({ where: { id: purchase.id }, data });

  // Aviso al cliente cuando el técnico sale en camino (best-effort).
  if (parsed.data.status === "ON_THE_WAY" && purchase.lead.clientEmail) {
    try {
      await sendClientOnTheWayEmail({
        to: purchase.lead.clientEmail,
        clientName: purchase.lead.clientName,
        technicianName: tech.displayName,
        serviceName: purchase.lead.service.name,
        trackUrl: `${getPublicBaseUrl()}/solicitud/${purchase.lead.publicToken}`,
      });
    } catch (e) {
      console.error("[status] email 'en camino' falló:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true, jobStatus: parsed.data.status });
}
