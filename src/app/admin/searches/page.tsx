import { prisma } from "@/lib/prisma";
import { requireAdminOrRedirect } from "../_lib/auth-guard";
import { SearchesClient } from "./_components/SearchesClient";

export const dynamic = "force-dynamic";

export default async function SearchesPage() {
  await requireAdminOrRedirect();

  const [searches, cities] = await Promise.all([
    prisma.serviceSearch.findMany({
      orderBy: [{ count: "desc" }, { lastSeenAt: "desc" }],
      take: 500,
      include: {
        matchedService: { select: { slug: true, name: true } },
      },
    }),
    prisma.city.findMany({
      where: { active: true },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <SearchesClient
      initial={searches.map((s) => ({
        id: s.id,
        rawQuery: s.rawQuery,
        normalizedQuery: s.normalizedQuery,
        citySlug: s.citySlug || null,
        hasMatch: s.hasMatch,
        count: s.count,
        email: s.email,
        phone: s.phone,
        status: s.status,
        adminNotes: s.adminNotes,
        source: s.source,
        matchedService: s.matchedService,
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
      }))}
      cities={cities}
    />
  );
}
