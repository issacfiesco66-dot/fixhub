import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setTechnicianSession } from "@/lib/auth";
import { sendAdminTechnicianNotification } from "@/lib/email";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BCRYPT_COST = 12;

// Política mínima de password (alineada con scripts/create-admin.ts)
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
    email: z.string().email().toLowerCase(),
    password: z.string().min(10).max(72),
    name: z.string().min(2).max(80),
    phone: z.string().min(10).max(20).regex(/^[+\d\s\-()]+$/),
    displayName: z.string().min(2).max(120),
    bio: z.string().max(500).optional(),
    yearsExp: z.number().int().min(0).max(60).default(0),
    citySlugs: z.array(z.string().min(1)).min(1, "Selecciona al menos una ciudad de cobertura").max(20),
    serviceSlugs: z.array(z.string().min(1)).min(1, "Selecciona al menos un servicio que ofreces").max(30),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "Debes aceptar los términos" }) }),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    // Rate limit anti-abuso: endpoint público que crea cuentas + dispara emails
    // al admin. 5 registros / 15min por IP evita creación masiva y email-bombing.
    const ip = getClientIp(req);
    const rl = await rateLimit(`register:${ip}`, 5, 15 * 60_000);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // Política de password
    const pwErr = validatePassword(d.password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    // Email único
    const existing = await prisma.user.findUnique({ where: { email: d.email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese correo" },
        { status: 409 }
      );
    }

    // Resolver ciudades + servicios desde slugs
    const [cities, services] = await Promise.all([
      prisma.city.findMany({
        where: { slug: { in: d.citySlugs }, active: true },
        select: { id: true, slug: true },
      }),
      prisma.service.findMany({
        where: { slug: { in: d.serviceSlugs }, active: true },
        select: { id: true, slug: true },
      }),
    ]);

    if (cities.length === 0) {
      return NextResponse.json({ error: "Ninguna ciudad válida seleccionada" }, { status: 400 });
    }
    if (services.length === 0) {
      return NextResponse.json({ error: "Ningún servicio válido seleccionado" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(d.password, BCRYPT_COST);

    // Creación atómica: User + Technician + coverages + services
    const tech = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: d.email,
          passwordHash,
          name: d.name,
          phone: d.phone,
          role: "TECHNICIAN",
        },
      });

      const technician = await tx.technician.create({
        data: {
          userId: user.id,
          displayName: d.displayName,
          bio: d.bio,
          yearsExp: d.yearsExp,
          balance: 0,
          active: true,
          verified: false, // admin debe verificar manualmente
        },
      });

      await tx.technicianCoverage.createMany({
        data: cities.map((c) => ({ technicianId: technician.id, cityId: c.id })),
      });
      await tx.technicianService.createMany({
        data: services.map((s) => ({ technicianId: technician.id, serviceId: s.id })),
      });

      return technician;
    });

    // Notificación al admin por correo (best-effort — no rompe el registro).
    try {
      await sendAdminTechnicianNotification({
        displayName: d.displayName,
        email: d.email,
        phone: d.phone,
        cities: cities.map((c) => c.slug),
        services: services.map((s) => s.slug),
      });
    } catch (e) {
      console.error("[register] notificación admin falló:", e instanceof Error ? e.message : e);
    }

    // Auto-login — setea cookie firmada
    await setTechnicianSession(tech.id);

    return NextResponse.json(
      {
        ok: true,
        technicianId: tech.id,
        verified: false,
        message:
          "¡Cuenta creada! Estamos verificando tu perfil. Te llegará una notificación cuando puedas empezar a recibir leads.",
      },
      { status: 201 }
    );
  } catch (e) {
    // Log interno completo, respuesta genérica al cliente (no filtrar detalles
    // de Prisma/runtime en una ruta pública).
    console.error("[api/auth/technician-register]", e);
    return NextResponse.json({ error: "No se pudo crear la cuenta. Intenta de nuevo." }, { status: 500 });
  }
}
