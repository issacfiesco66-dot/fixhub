import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, getCurrentTechnician } from "@/lib/auth";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BCRYPT_COST = 12;

// Política igual que registro de técnico (10+ chars con mayús/minús/núm).
// Admin idealmente debería usar 12+ pero el flow soporta cualquier user-role.
function validatePassword(pw: string): string | null {
  if (pw.length < 10) return "Mínimo 10 caracteres.";
  if (!/[a-z]/.test(pw)) return "Debe incluir una minúscula.";
  if (!/[A-Z]/.test(pw)) return "Debe incluir una mayúscula.";
  if (!/[0-9]/.test(pw)) return "Debe incluir un número.";
  const weak = ["password", "demo1234", "qwerty", "12345678"];
  if (weak.some((w) => pw.toLowerCase().includes(w))) {
    return "Password contiene una palabra demasiado común.";
  }
  return null;
}

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(10).max(72),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 intentos por 15 min por IP (anti brute-force del actual password)
    const ip = getClientIp(req);
    const rl = rateLimit(`change-pwd:${ip}`, 5, 15 * 60_000);
    if (!rl.allowed) return rateLimitResponse(rl);

    // Identificar al usuario actual — admin O tech
    const [admin, tech] = await Promise.all([getCurrentAdmin(), getCurrentTechnician()]);
    const userId = admin?.id ?? tech?.userId;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const { currentPassword, newPassword } = parsed.data;

    const pwErr = validatePassword(newPassword);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "El password actual no coincide" },
        { status: 401 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "El nuevo password debe ser diferente al actual" },
        { status: 400 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ ok: true, message: "Password actualizado" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("[api/auth/change-password]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
