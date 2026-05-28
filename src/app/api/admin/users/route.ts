// GET /api/admin/users — lista con filtros (role, search).
// POST /api/admin/users — crea usuario. ADMIN exige password (login con password).

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { userCreateSchema } from "@/lib/validators";
import { isUniqueError } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BCRYPT_COST = 12;

export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = req.nextUrl.searchParams.get("role");
  const search = req.nextUrl.searchParams.get("search");

  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role: role as "CLIENT" | "TECHNICIAN" | "ADMIN" } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
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

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      isTechnician: !!u.technician,
      leadCount: u._count.leads,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  // ADMIN inicia sesión con email+password → password obligatorio.
  if (d.role === "ADMIN" && !d.password) {
    return NextResponse.json({ error: "Un admin requiere contraseña (mín. 8 caracteres)" }, { status: 400 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        email: d.email,
        name: d.name || null,
        phone: d.phone || null,
        role: d.role,
        passwordHash: d.password ? await bcrypt.hash(d.password, BCRYPT_COST) : null,
      },
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (e) {
    if (isUniqueError(e)) {
      return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
    }
    console.error("[api/admin/users POST]", e);
    return NextResponse.json({ error: "Error al crear el usuario" }, { status: 500 });
  }
}
