import { prisma } from "@/lib/prisma";
import { requireAdminOrRedirect } from "../_lib/auth-guard";
import { UsersClient } from "./_components/UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const admin = await requireAdminOrRedirect();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
      technician: { select: { id: true } },
      _count: { select: { leads: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return (
    <UsersClient
      currentAdminId={admin.id}
      initial={users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        role: u.role,
        isTechnician: !!u.technician,
        leadCount: u._count.leads,
        createdAt: u.createdAt.toISOString(),
      }))}
    />
  );
}
