import { prisma } from "@/lib/prisma";
import { requireAdminOrRedirect } from "../_lib/auth-guard";
import { TechniciansClient } from "./_components/TechniciansClient";

export const dynamic = "force-dynamic";

export default async function AdminTechniciansPage() {
  await requireAdminOrRedirect();

  const [technicians, cities, services] = await Promise.all([
    prisma.technician.findMany({
      include: {
        user: true,
        coverages: { select: { cityId: true } },
        services: { select: { serviceId: true } },
        _count: { select: { purchases: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.city.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <TechniciansClient
      initial={technicians.map((t) => ({
        id: t.id,
        displayName: t.displayName,
        legalName: t.user.name,
        email: t.user.email,
        phone: t.user.phone,
        bio: t.bio,
        yearsExp: t.yearsExp,
        balance: t.balance,
        verified: t.verified,
        active: t.active,
        purchaseCount: t._count.purchases,
        cityIds: t.coverages.map((c) => c.cityId),
        serviceIds: t.services.map((s) => s.serviceId),
      }))}
      cities={cities.map((c) => ({ value: c.id, label: c.name }))}
      services={services.map((s) => ({ value: s.id, label: s.name }))}
    />
  );
}
