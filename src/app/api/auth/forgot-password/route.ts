import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { getPublicBaseUrl } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email().toLowerCase() }).strict();

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

// SHA-256 — más rápido que bcrypt y suficiente para tokens random de alta entropía
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 solicitudes / 15min por IP (anti email-bombing)
    const ip = getClientIp(req);
    const rl = await rateLimit(`forgot:${ip}`, 3, 15 * 60_000);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    const { email } = parsed.data;

    // Anti-enumeration: respondemos igual siempre (existe o no el email).
    // El "si existe" se hace lookup y send en background, devolvemos 200 ya.
    const okResponse = NextResponse.json({
      ok: true,
      message: "Si existe una cuenta con ese correo, te enviamos instrucciones.",
    });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return okResponse; // mismo mensaje

    // Generar token random 32 bytes → 64 chars hex
    const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    // Invalidar tokens previos no usados del mismo user (housekeeping)
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const appUrl = getPublicBaseUrl();
    const resetUrl = `${appUrl}/restablecer-pass?token=${rawToken}`;

    try {
      await sendPasswordResetEmail({ to: email, resetUrl, userName: user.name });
    } catch (e) {
      // Si Resend falla (no key configurada en MVP, o falla API), no le decimos
      // al cliente para no leak info. Log para el admin.
      console.error("[forgot-password] email send failed:", e instanceof Error ? e.message : e);
      // En dev: imprimir el link para que el operador lo copie
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Reset URL para ${email}: ${resetUrl}`);
      }
    }

    return okResponse;
  } catch (e) {
    console.error("[api/auth/forgot-password]", e);
    return NextResponse.json({ error: "Error interno. Intenta de nuevo." }, { status: 500 });
  }
}
