import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe webhook — abona créditos cuando el pago se confirma.
// Idempotente: si el evento llega dos veces, no duplica el abono.
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("[stripe webhook] signature error", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const technicianId = session.metadata?.technicianId;
    const credits = Number(session.metadata?.credits ?? 0);
    if (!technicianId || !credits) {
      return NextResponse.json({ ok: true, ignored: "missing metadata" });
    }

    await prisma.$transaction(async (tx) => {
      // Idempotencia: si ya está COMPLETED, no toques nada
      const existing = await tx.balanceTransaction.findUnique({
        where: { stripeSessionId: session.id },
      });
      if (existing?.status === "COMPLETED") return;

      const tech = await tx.technician.update({
        where: { id: technicianId },
        data: { balance: { increment: credits } },
      });

      if (existing) {
        await tx.balanceTransaction.update({
          where: { id: existing.id },
          data: {
            status: "COMPLETED",
            balanceAfter: tech.balance,
            stripePaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
            description: existing.description?.replace(" (pendiente)", " (confirmado)") ?? "Recarga confirmada",
          },
        });
      } else {
        await tx.balanceTransaction.create({
          data: {
            technicianId,
            type: "RECHARGE",
            status: "COMPLETED",
            amount: credits,
            balanceAfter: tech.balance,
            description: "Recarga confirmada",
            stripeSessionId: session.id,
            stripePaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
          },
        });
      }
    });
  }

  return NextResponse.json({ received: true });
}
