import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TrackingClient } from "./_components/TrackingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seguimiento de tu solicitud — FixHub",
  // Página privada por token: no debe indexarse.
  robots: { index: false, follow: false },
};

export default async function SolicitudPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const lead = await prisma.lead.findUnique({
    where: { publicToken: token },
    include: {
      service: true,
      brand: true,
      city: true,
      zone: true,
      purchase: { include: { technician: true, review: true } },
    },
  });

  if (!lead) notFound();

  const p = lead.purchase;
  const canCancel =
    lead.status !== "CANCELLED" &&
    !(p && (p.jobStatus === "COMPLETED" || p.jobCompleted));

  const data = {
    token,
    status: lead.status as "PENDING" | "PURCHASED" | "EXPIRED" | "CANCELLED",
    jobStatus: (p?.jobStatus ?? null) as
      | "ASSIGNED"
      | "ON_THE_WAY"
      | "ARRIVED"
      | "COMPLETED"
      | "CANCELLED"
      | null,
    serviceName: lead.service.name,
    brandName: lead.brand?.name ?? null,
    cityName: lead.city.name,
    zoneName: lead.zone?.name ?? null,
    clientName: lead.clientName,
    failure: lead.failure,
    createdAt: lead.createdAt.toISOString(),
    expiresAt: lead.expiresAt.toISOString(),
    technician: p
      ? {
          name: p.technician.displayName,
          rating: p.technician.rating,
          totalJobs: p.technician.totalJobs,
          yearsExp: p.technician.yearsExp,
        }
      : null,
    reviewUrl: p?.review?.token ? `/calificar/${p.review.token}` : null,
    canCancel,
    timestamps: {
      onTheWayAt: p?.onTheWayAt?.toISOString() ?? null,
      arrivedAt: p?.arrivedAt?.toISOString() ?? null,
      completedAt: p?.completedAt?.toISOString() ?? null,
    },
  };

  return <TrackingClient data={data} />;
}
