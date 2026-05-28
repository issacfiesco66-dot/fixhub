import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTechnician } from "@/lib/auth";
import type { RepairDiagnosis } from "@/lib/ai-diagnosis";
import { TechnicianDashboard } from "./_components/TechnicianDashboard";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const tech = await getCurrentTechnician();
  if (!tech) redirect("/panel/login");

  const [activeLeads, recentPurchases, packages] = await Promise.all([
    prisma.lead.findMany({
      where: {
        status: "PENDING",
        expiresAt: { gt: new Date() },
        cityId: { in: tech.coverages.map((c) => c.cityId) },
        serviceId: { in: tech.services.map((s) => s.serviceId) },
      },
      select: {
        id: true,
        failure: true,
        urgency: true,
        price: true,
        createdAt: true,
        expiresAt: true,
        addressHint: true,
        service: { select: { name: true } },
        brand: { select: { name: true } },
        city: { select: { name: true } },
        zone: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.leadPurchase.findMany({
      where: { technicianId: tech.id },
      include: {
        lead: {
          include: { service: true, brand: true, city: true, zone: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.rechargePackage.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    }),
  ]);

  return (
    <TechnicianDashboard
      technician={{
        id: tech.id,
        name: tech.displayName,
        balance: tech.balance,
        verified: tech.verified,
        coverages: tech.coverages.map((c) => ({ id: c.city.id, name: c.city.name })),
        services: tech.services.map((s) => ({ id: s.service.id, name: s.service.name })),
      }}
      initialLeads={activeLeads.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
        expiresAt: l.expiresAt.toISOString(),
      }))}
      recentPurchases={recentPurchases.map((p) => ({
        id: p.id,
        leadId: p.leadId,
        pricePaid: p.pricePaid,
        createdAt: p.createdAt.toISOString(),
        serviceName: p.lead.service.name,
        brandName: p.lead.brand?.name ?? null,
        cityName: p.lead.city.name,
        zoneName: p.lead.zone?.name ?? null,
        clientName: p.lead.clientName,
        clientPhone: p.lead.clientPhone,
        failure: p.lead.failure,
        diagnosis: (p.diagnosis as RepairDiagnosis | null) ?? null,
      }))}
      packages={packages}
    />
  );
}
