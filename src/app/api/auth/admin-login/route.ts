import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setAdminSession } from "@/lib/auth";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Hash bcrypt fijo (cost 12) para igualar el tiempo de respuesta cuando el
// usuario no existe — evita enumeración de cuentas admin por timing.
const DUMMY_HASH = "$2a$12$929luAeSkZqEIqR5sEDB/O2mTHDxR/SVxNrHoiaZvl4zcEYG06m/W";

// Rate limit anti brute-force admin: 5 intentos por 15 min por IP.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`admin-login:${ip}`, 5, 15 * 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Siempre ejecutamos bcrypt.compare (hash dummy si no hay user) para no
  // delatar por tiempo si el email existe.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  await setAdminSession(user.id);
  return NextResponse.json({ ok: true });
}
