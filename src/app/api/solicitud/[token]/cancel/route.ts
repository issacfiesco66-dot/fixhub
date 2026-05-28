// POST /api/solicitud/[token]/cancel — el CLIENTE cancela su solicitud desde el
// link público de seguimiento (sin cuenta). Reglas:
//   - No se puede cancelar si el trabajo ya está COMPLETED.
//   - Si un técnico ya compró el lead y aún no llega (ASSIGNED/ON_THE_WAY),
//     se le reembolsa el costo del lead a su SALDO INTERNO (no toca Stripe) y
//     se le avisa por email. Si ya llegó (ARRIVED), se cancela sin reembolso
//     automático (el técnico ya invirtió el traslado).
// Público + rate-limited para evitar abuso.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { sendTechJobCancelledEmail, sendAdminCancellationNotification } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`cancel:${ip}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { token } = await params;

  const lead = await prisma.lead.findUnique({
    where: { publicToken: token },
    include: {
      service: true,
      city: true,
      purchase: { include: { technician: { include: { user: true } } } },
    },
  });
  if (!lead) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }
  if (lead.status === "CANCELLED") {
    return NextResponse.json({ error: "Esta solicitud ya fue cancelada" }, { status: 409 });
  }

  const purchase = lead.purchase;
  if (purchase && (purchase.jobStatus === "COMPLETED" || purchase.jobCompleted)) {
    return NextResponse.json(
      { error: "Este servicio ya se completó y no puede cancelarse." },
      { status: 409 }
    );
  }

  // Reembolso al técnico solo si compró pagando y aún no llegaba.
  const refundable =
    !!purchase &&
    purchase.pricePaid > 0 &&
    (purchase.jobStatus === "ASSIGNED" || purchase.jobStatus === "ON_THE_WAY");
  const refundAmount = refundable ? purchase!.pricePaid : 0;

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: lead.id }, data: { status: "CANCELLED" } });

    if (purchase) {
      await tx.leadPurchase.update({
        where: { id: purchase.id },
        data: { jobStatus: "CANCELLED" },
      });
    }

    if (refundable && purchase) {
      const updatedTech = await tx.technician.update({
        where: { id: purchase.technicianId },
        data: { balance: { increment: refundAmount } },
      });
      await tx.balanceTransaction.create({
        data: {
          technicianId: purchase.technicianId,
          type: "REFUND",
          status: "COMPLETED",
          amount: refundAmount,
          balanceAfter: updatedTech.balance,
          description: `Reembolso por cancelación del cliente — ${lead.service.name}`,
          leadPurchaseId: purchase.id,
        },
      });
    }
  });

  // Avisos best-effort (no rompen la respuesta).
  if (purchase?.technician?.user?.email) {
    try {
      await sendTechJobCancelledEmail({
        to: purchase.technician.user.email,
        technicianName: purchase.technician.displayName,
        serviceName: lead.service.name,
        cityName: lead.city.name,
        refunded: refundable,
        refundAmount,
      });
    } catch (e) {
      console.error("[cancel] email técnico falló:", e instanceof Error ? e.message : e);
    }
    try {
      await sendAdminCancellationNotification({
        service: lead.service.name,
        city: lead.city.name,
        technicianName: purchase.technician.displayName,
        refunded: refundable,
        refundAmount,
      });
    } catch (e) {
      console.error("[cancel] email admin falló:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true, refunded: refundable });
}
