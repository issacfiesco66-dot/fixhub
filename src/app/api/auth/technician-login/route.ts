import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setTechnicianSession } from "@/lib/auth";

export const runtime = "nodejs";

// Login mínimo para MVP — reemplazar por NextAuth/Auth.js cuando integres flujo completo.
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { technician: true },
  });
  if (!user || !user.passwordHash || user.role !== "TECHNICIAN" || !user.technician) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  await setTechnicianSession(user.technician.id);
  return NextResponse.json({ ok: true, technicianId: user.technician.id });
}
