import { prisma } from "@/lib/prisma";
import { requireAdminOrRedirect } from "../layout";
import { ProspectsClient } from "./_components/ProspectsClient";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  await requireAdminOrRedirect();

  const prospects = await prisma.prospect.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <ProspectsClient
      initial={prospects.map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        email: p.email,
        city: p.city,
        source: p.source,
        notes: p.notes,
        status: p.status,
        contactedAt: p.contactedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
