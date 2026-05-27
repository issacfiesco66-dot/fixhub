import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getCurrentTechnician } from "@/lib/auth";
import { createRechargeSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/billing/checkout — crea sesión Stripe Checkout para recargar saldo.
// Devuelve la URL al frontend, que abre el flujo embebido (Stripe Elements) o redirect.
export async function POST(req: NextRequest) {
  const tech = await getCurrentTechnician();
  if (!tech) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createRechargeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const pkg = await prisma.rechargePackage.findUnique({
    where: { id: parsed.data.packageId },
  });
  if (!pkg || !pkg.active) {
    return NextResponse.json({ error: "Paquete no disponible" }, { status: 404 });
  }

  const totalCredits = pkg.amount + pkg.bonus;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "oxxo"],
    line_items: [
      {
        price_data: {
          currency: "mxn",
          unit_amount: pkg.amount * 100, // centavos
          product_data: {
            name: pkg.name,
            description: pkg.bonus > 0 ? `Recibe ${totalCredits} créditos (${pkg.bonus} de bono)` : `Recibe ${totalCredits} créditos`,
          },
        },
        quantity: 1,
      },
    ],
    customer_email: tech.user.email,
    metadata: {
      technicianId: tech.id,
      packageId: pkg.id,
      credits: String(totalCredits),
    },
    success_url: `${appUrl}/panel?recarga=ok&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/panel?recarga=cancelada`,
  });

  // Pre-registro pendiente — el webhook lo marca COMPLETED
  await prisma.balanceTransaction.create({
    data: {
      technicianId: tech.id,
      type: "RECHARGE",
      status: "PENDING",
      amount: totalCredits,
      balanceAfter: tech.balance, // se actualiza en el webhook
      description: `Recarga ${pkg.name} (pendiente)`,
      stripeSessionId: session.id,
      metadata: { packageId: pkg.id, amount: pkg.amount, bonus: pkg.bonus },
    },
  });

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
