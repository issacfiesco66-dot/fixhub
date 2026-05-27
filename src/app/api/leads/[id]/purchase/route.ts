import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTechnician } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leads/:id/purchase
// Compra exclusiva con transacción atómica. La exclusividad la garantiza
// el @unique en LeadPurchase.leadId — si dos técnicos hacen click a la vez,
// uno gana (P2002), el otro recibe "ya vendido".
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tech = await getCurrentTechnician();
  if (!tech) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: leadId } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Releer el lead dentro de la tx — congelado a este momento
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
        include: { service: true, brand: true, city: true, zone: true },
      });
      if (!lead) throw new BizError("LEAD_NOT_FOUND", "El lead ya no existe");
      if (lead.status !== "PENDING") {
        throw new BizError("LEAD_TAKEN", "Este lead ya fue tomado por otro técnico");
      }
      if (lead.expiresAt < new Date()) {
        throw new BizError("LEAD_EXPIRED", "Este lead expiró");
      }

      // 2. Releer el balance del técnico (no confiar en el cache de UI)
      const techRow = await tx.technician.findUnique({ where: { id: tech.id } });
      if (!techRow) throw new BizError("TECH_NOT_FOUND", "Técnico no encontrado");
      if (techRow.balance < lead.price) {
        throw new BizError("INSUFFICIENT_FUNDS", "Saldo insuficiente", {
          balance: techRow.balance,
          required: lead.price,
        });
      }

      // 3. Crear la compra (aquí se aplica el lock por @unique)
      const purchase = await tx.leadPurchase.create({
        data: {
          leadId: lead.id,
          technicianId: tech.id,
          pricePaid: lead.price,
        },
      });

      // 4. Debitar saldo + actualizar status
      const updatedTech = await tx.technician.update({
        where: { id: tech.id },
        data: { balance: { decrement: lead.price } },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: { status: "PURCHASED" },
      });

      // 5. Registro contable
      await tx.balanceTransaction.create({
        data: {
          technicianId: tech.id,
          type: "LEAD_PURCHASE",
          status: "COMPLETED",
          amount: -lead.price,
          balanceAfter: updatedTech.balance,
          description: `Compra de lead ${lead.service.name}${lead.brand ? ` - ${lead.brand.name}` : ""} en ${lead.city.name}`,
          leadPurchaseId: purchase.id,
        },
      });

      return {
        purchase,
        newBalance: updatedTech.balance,
        contact: {
          clientName: lead.clientName,
          clientPhone: lead.clientPhone,
          clientEmail: lead.clientEmail,
          addressHint: lead.addressHint,
        },
        lead: {
          id: lead.id,
          service: lead.service.name,
          brand: lead.brand?.name ?? null,
          city: lead.city.name,
          zone: lead.zone?.name ?? null,
          failure: lead.failure,
          urgency: lead.urgency,
        },
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof BizError) {
      const status = err.code === "INSUFFICIENT_FUNDS" ? 402 : err.code === "LEAD_TAKEN" ? 409 : 400;
      return NextResponse.json({ error: err.message, code: err.code, ...err.meta }, { status });
    }
    // Race condition: dos clicks simultáneos — el segundo cae aquí
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Este lead ya fue tomado por otro técnico", code: "LEAD_TAKEN" },
        { status: 409 }
      );
    }
    console.error("[purchase] unexpected", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

class BizError extends Error {
  constructor(public code: string, message: string, public meta?: Record<string, unknown>) {
    super(message);
  }
}
