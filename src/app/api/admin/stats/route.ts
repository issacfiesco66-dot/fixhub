import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/stats — números agregados para el dashboard
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalLeads,
    pendingLeads,
    purchasedLeads,
    leads30d,
    totalTechs,
    verifiedTechs,
    activeTechs,
    revenueAgg,
    prospectsByStatus,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: "PENDING" } }),
    prisma.lead.count({ where: { status: "PURCHASED" } }),
    prisma.lead.count({ where: { createdAt: { gte: since30d } } }),
    prisma.technician.count(),
    prisma.technician.count({ where: { verified: true } }),
    prisma.technician.count({ where: { active: true } }),
    prisma.balanceTransaction.aggregate({
      where: {
        type: "RECHARGE",
        status: "COMPLETED",
        createdAt: { gte: since30d },
      },
      _sum: { amount: true },
    }),
    prisma.prospect.groupBy({ by: ["status"], _count: { status: true } }),
  ]);

  const prospectStats: Record<string, number> = { NEW: 0, CONTACTED: 0, CONVERTED: 0, DISCARDED: 0 };
  for (const p of prospectsByStatus) prospectStats[p.status] = p._count.status;

  return NextResponse.json({
    leads: {
      total: totalLeads,
      pending: pendingLeads,
      purchased: purchasedLeads,
      last30d: leads30d,
      conversionRate: totalLeads ? Math.round((purchasedLeads / totalLeads) * 100) : 0,
    },
    technicians: {
      total: totalTechs,
      verified: verifiedTechs,
      active: activeTechs,
    },
    revenue: {
      last30d: revenueAgg._sum.amount ?? 0,
    },
    prospects: prospectStats,
  });
}
