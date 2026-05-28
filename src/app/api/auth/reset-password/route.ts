import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BCRYPT_COST = 12;

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
    token: z.string().length(64), // 32 bytes hex
    newPassword: z.string().min(10).max(72),
  })
  .strict();

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 intentos / 15min por IP (anti brute-force del token)
    const ip = getClientIp(req);
    const rl = rateLimit(`reset:${ip}`, 5, 15 * 60_000);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos o token mal formado" }, { status: 400 });
    }
    const { token, newPassword } = parsed.data;

    const pwErr = validatePassword(newPassword);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      return NextResponse.json({ error: "Token inválido o ya usado" }, { status: 400 });
    }
    if (record.usedAt) {
      return NextResponse.json({ error: "Este enlace ya fue usado" }, { status: 400 });
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json({ error: "El enlace expiró. Solicita uno nuevo." }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    // Atomic: actualiza password, marca token usado, borra otros tokens del user
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: newHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Contraseña actualizada. Ya puedes iniciar sesión.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("[api/auth/reset-password]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
