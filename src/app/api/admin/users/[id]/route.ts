// PATCH /api/admin/users/[id] — edita name/phone/role/password.
// DELETE /api/admin/users/[id] — borra usuario.
//
// Protecciones anti-lockout: el admin no puede quitarse su propio rol ADMIN
// ni borrarse a sí mismo (evita quedarse sin acceso).

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validators";
import { isForeignKeyError, isUniqueError } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BCRYPT_COST = 12;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, passwordHash: true } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // Anti-lockout: no permitir que el admin se quite su propio rol ADMIN.
  if (id === admin.id && d.role && d.role !== "ADMIN") {
    return NextResponse.json({ error: "No puedes quitarte tu propio rol de administrador" }, { status: 400 });
  }

  // Promover a ADMIN sin password previo y sin password nuevo → no podría loguear.
  if (d.role === "ADMIN" && !target.passwordHash && !d.password) {
    return NextResponse.json({ error: "Para hacerlo admin, asigna una contraseña" }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name || null } : {}),
        ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
        ...(d.role !== undefined ? { role: d.role } : {}),
        ...(d.password ? { passwordHash: await bcrypt.hash(d.password, BCRYPT_COST) } : {}),
      },
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    if (isUniqueError(e)) return NextResponse.json({ error: "Email duplicado" }, { status: 409 });
    console.error("[api/admin/users PATCH]", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "No puedes borrar tu propia cuenta" }, { status: 400 });
  }

  try {
    // PasswordResetToken y Technician tienen cascade. Si el técnico asociado
    // tiene compras/transacciones, el FK bloquea. Lead.clientId (opcional) → null.
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isForeignKeyError(e)) {
      return NextResponse.json(
        { error: "Este usuario tiene historial (técnico con compras). No se puede borrar." },
        { status: 409 }
      );
    }
    console.error("[api/admin/users DELETE]", e);
    return NextResponse.json({ error: "Error al borrar el usuario" }, { status: 500 });
  }
}
