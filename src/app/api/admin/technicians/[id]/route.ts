import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { technicianUpdateSchema } from "@/lib/validators";
import { isForeignKeyError } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/technicians/:id — verifica/activa + edita datos + ajusta saldo
// + re-sincroniza coberturas y servicios.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = technicianUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    const tech = await prisma.technician.findUnique({ where: { id }, select: { id: true, balance: true } });
    if (!tech) return NextResponse.json({ error: "Técnico no encontrado" }, { status: 404 });

    // Ajuste de saldo: registra una BalanceTransaction tipo ADJUSTMENT y actualiza
    // el balance de forma atómica. El balance es dinero real → siempre auditado.
    const adjustment = d.balanceAdjustment ?? 0;
    const newBalance = tech.balance + adjustment;
    if (adjustment !== 0 && newBalance < 0) {
      return NextResponse.json({ error: "El ajuste dejaría el saldo en negativo" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.technician.update({
        where: { id },
        data: {
          ...(d.verified !== undefined ? { verified: d.verified } : {}),
          ...(d.active !== undefined ? { active: d.active } : {}),
          ...(d.displayName !== undefined ? { displayName: d.displayName } : {}),
          ...(d.bio !== undefined ? { bio: d.bio || null } : {}),
          ...(d.yearsExp !== undefined ? { yearsExp: d.yearsExp } : {}),
          ...(adjustment !== 0 ? { balance: newBalance } : {}),
          ...(d.cityIds !== undefined
            ? { coverages: { deleteMany: {}, create: d.cityIds.map((cityId) => ({ cityId })) } }
            : {}),
          ...(d.serviceIds !== undefined
            ? { services: { deleteMany: {}, create: d.serviceIds.map((serviceId) => ({ serviceId })) } }
            : {}),
        },
      });

      if (adjustment !== 0) {
        await tx.balanceTransaction.create({
          data: {
            technicianId: id,
            type: "ADJUSTMENT",
            status: "COMPLETED",
            amount: adjustment,
            balanceAfter: newBalance,
            description: d.balanceReason || `Ajuste manual del admin (${admin.email})`,
          },
        });
      }
    });

    const updated = await prisma.technician.findUnique({
      where: { id },
      include: {
        user: true,
        coverages: { include: { city: true } },
        services: { include: { service: true } },
      },
    });

    return NextResponse.json({ ok: true, technician: updated });
  } catch (e) {
    console.error("[api/admin/technicians/:id PATCH]", e);
    return NextResponse.json({ error: "Error interno al actualizar el técnico." }, { status: 500 });
  }
}

// DELETE /api/admin/technicians/:id — borra el técnico y su cuenta de usuario.
// Si tiene compras o transacciones (historial financiero), el FK lo impide → 409.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tech = await prisma.technician.findUnique({ where: { id }, select: { userId: true } });
  if (!tech) return NextResponse.json({ error: "Técnico no encontrado" }, { status: 404 });

  try {
    // coverages y services tienen cascade. purchases y transactions NO → bloquean.
    // Borramos technician y su user en una transacción atómica.
    await prisma.$transaction([
      prisma.technician.delete({ where: { id } }),
      prisma.user.delete({ where: { id: tech.userId } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isForeignKeyError(e)) {
      return NextResponse.json(
        { error: "Este técnico tiene compras o historial de saldo. Desactívalo en lugar de borrarlo." },
        { status: 409 }
      );
    }
    console.error("[api/admin/technicians/:id DELETE]", e);
    return NextResponse.json({ error: "Error al borrar el técnico" }, { status: 500 });
  }
}
