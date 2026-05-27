import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe webhook — abona créditos cuando el pago se confirma.
//
// Hardening del audit (C-3 + M-4):
//   1. Verifica firma Stripe (ya existía)
//   2. Re-fetch la Checkout Session desde Stripe API (no confiar en el payload)
//   3. Verifica payment_status === "paid" (OXXO acredita después de pago real)
//   4. Valida amount_total contra el RechargePackage del DB (anti-tampering)
//   5. updateMany con guard de status — atómico, race-safe
//   6. Maneja async_payment_succeeded para OXXO, async_payment_failed para
//      marcar FAILED
//   7. Tabla anti-replay por eventId
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

  // ── Idempotencia anti-replay por eventId ──────────────────────
  // Si Stripe reentrega el mismo evento (network blip, retry policy),
  // no procesamos dos veces. Stripe garantiza event.id único.
  try {
    await prisma.processedWebhookEvent.create({
      data: { eventId: event.id, type: event.type },
    });
  } catch (e) {
    // unique constraint violation => ya procesado
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw e;
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await creditBalance(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await markFailed(event.data.object as Stripe.Checkout.Session);
      break;
    default:
      // ignoramos otros eventos
      break;
  }

  return NextResponse.json({ received: true });
}

async function creditBalance(session: Stripe.Checkout.Session) {
  const technicianId = session.metadata?.technicianId;
  const packageId = session.metadata?.packageId;
  if (!technicianId || !packageId) {
    console.warn("[webhook] missing metadata on session", session.id);
    return;
  }

  // Re-fetch la session desde Stripe — no confiamos en el payload del webhook
  // por si fue manipulado vía tampering del raw body (la firma protege contra
  // eso, pero defensa en profundidad).
  const verifiedSession = await stripe.checkout.sessions.retrieve(session.id);
  if (verifiedSession.payment_status !== "paid") {
    console.warn("[webhook] session not paid yet, skipping credit", session.id);
    return;
  }

  // Validar monto contra el paquete del DB (anti-tampering del metadata.credits)
  const pkg = await prisma.rechargePackage.findUnique({ where: { id: packageId } });
  if (!pkg) {
    console.error("[webhook] package not found", packageId);
    return;
  }
  if (verifiedSession.amount_total !== pkg.amount * 100) {
    console.error(
      `[webhook] amount mismatch: session=${verifiedSession.amount_total} expected=${pkg.amount * 100}`,
      session.id
    );
    return;
  }
  const credits = pkg.amount + pkg.bonus;

  await prisma.$transaction(async (tx) => {
    // Guard atómico: updateMany devuelve {count:0} si el row ya está COMPLETED
    // (otra entrega del webhook ganó la carrera). Esto elimina la TOCTOU
    // race que el audit identificó como C-3.
    const updated = await tx.balanceTransaction.updateMany({
      where: { stripeSessionId: session.id, status: "PENDING" },
      data: {
        status: "COMPLETED",
        stripePaymentId:
          typeof verifiedSession.payment_intent === "string"
            ? verifiedSession.payment_intent
            : null,
      },
    });

    if (updated.count === 0) {
      // O ya está COMPLETED (otro fired primero) o nunca se pre-registró
      const existing = await tx.balanceTransaction.findUnique({
        where: { stripeSessionId: session.id },
      });
      if (existing) return; // ya completed, all good
      // Caso: no hay pre-registro — alguien creó la session fuera de nuestro flujo
      // Lo procesamos pero loggeamos
      console.warn("[webhook] no pre-registered transaction for session", session.id);
    }

    const tech = await tx.technician.update({
      where: { id: technicianId },
      data: { balance: { increment: credits } },
    });

    if (updated.count === 0) {
      // Fallback: crear el record si no existía
      await tx.balanceTransaction.create({
        data: {
          technicianId,
          type: "RECHARGE",
          status: "COMPLETED",
          amount: credits,
          balanceAfter: tech.balance,
          description: `Recarga confirmada (${pkg.name})`,
          stripeSessionId: session.id,
          stripePaymentId:
            typeof verifiedSession.payment_intent === "string"
              ? verifiedSession.payment_intent
              : null,
        },
      });
    } else {
      // Actualizar balanceAfter en el row pre-existente
      await tx.balanceTransaction.update({
        where: { stripeSessionId: session.id },
        data: {
          balanceAfter: tech.balance,
          description: `Recarga ${pkg.name} (confirmada)`,
        },
      });
    }
  });
}

async function markFailed(session: Stripe.Checkout.Session) {
  await prisma.balanceTransaction.updateMany({
    where: { stripeSessionId: session.id, status: "PENDING" },
    data: { status: "FAILED", description: "Pago fallido o sesión expirada" },
  });
}
