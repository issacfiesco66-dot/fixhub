import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentTechnician } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/billing/me — saldo + últimas transacciones
export async function GET() {
  const tech = await getCurrentTechnician();
  if (!tech) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const fresh = await prisma.technician.findUnique({
    where: { id: tech.id },
    select: { balance: true },
  });

  const transactions = await prisma.balanceTransaction.findMany({
    where: { technicianId: tech.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    balance: fresh?.balance ?? 0,
    transactions,
  });
}
