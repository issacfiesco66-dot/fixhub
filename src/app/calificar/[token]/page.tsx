import Link from "next/link";
import { Wrench, CheckCircle2, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ReviewForm } from "./_components/ReviewForm";

export const dynamic = "force-dynamic";

export default async function CalificarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const review = await prisma.review.findUnique({
    where: { token },
    include: {
      technician: { select: { displayName: true } },
      leadPurchase: {
        include: { lead: { include: { service: { select: { name: true } }, brand: { select: { name: true } } } } },
      },
    },
  });

  const technicianName = review?.technician.displayName ?? "";
  const serviceName = review?.leadPurchase.lead.service.name ?? "";

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-white p-4">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_60%)]"
      />
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/30">
            <Wrench className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-zinc-900">FixHub</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_8px_30px_rgb(99,102,241,0.06)]">
          {!review ? (
            <div className="text-center">
              <h1 className="mb-2 text-xl font-bold text-zinc-900">Enlace no válido</h1>
              <p className="text-sm text-zinc-500">
                Este enlace de calificación no existe o expiró.
              </p>
              <Link href="/" className="mt-5 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700">
                Ir a FixHub
              </Link>
            </div>
          ) : review.submittedAt ? (
            <div className="text-center">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h1 className="mb-1 text-xl font-bold text-zinc-900">¡Gracias!</h1>
              <p className="text-sm text-zinc-500">
                Ya registramos tu calificación{review.rating ? ` de ${review.rating} ` : " "}
                {review.rating ? <Star className="inline h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}. Tu
                opinión nos ayuda a mantener a los mejores técnicos.
              </p>
              <Link href="/" className="mt-5 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700">
                Ir a FixHub
              </Link>
            </div>
          ) : (
            <ReviewForm token={token} technicianName={technicianName} serviceName={serviceName} />
          )}
        </div>
      </div>
    </main>
  );
}
