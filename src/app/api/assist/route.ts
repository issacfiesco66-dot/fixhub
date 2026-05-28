// POST /api/assist — Asistente IA libre del técnico (reparación / instalación
// / mantenimiento de cualquier equipo, sin atarse a un lead).
//
// Control de costo de IA: rate-limit corto in-memory (anti-spam) + límite de
// 15 consultas por 24h contadas en DB (TechAssistLog), que sobrevive a los
// cold starts serverless (el limiter in-memory no).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTechnician } from "@/lib/auth";
import { generateTechAssist } from "@/lib/ai-diagnosis";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAILY_LIMIT = 15;

const schema = z
  .object({
    workType: z.enum(["reparacion", "instalacion", "mantenimiento"]),
    equipment: z.string().min(2, "Indica el equipo").max(160),
    description: z.string().min(3, "Describe el trabajo").max(800),
  })
  .strict();

export async function POST(req: NextRequest) {
  const tech = await getCurrentTechnician();
  if (!tech) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Anti-spam inmediato: 5 por minuto.
  const rl = await rateLimit(`assist:${tech.id}`, 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }

  // Límite diario (ventana rodante de 24h) contado en DB.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const usedToday = await prisma.techAssistLog.count({
    where: { technicianId: tech.id, createdAt: { gte: since } },
  });
  if (usedToday >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Alcanzaste el límite de ${DAILY_LIMIT} consultas en 24h. Intenta mañana.`, limit: DAILY_LIMIT },
      { status: 429 }
    );
  }

  const { workType, equipment, description } = parsed.data;

  let result;
  try {
    result = await generateTechAssist({ workType, equipment, description });
  } catch (e) {
    console.error("[assist] generación falló:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "No se pudo generar la respuesta. Intenta de nuevo en un momento." },
      { status: 502 }
    );
  }

  await prisma.techAssistLog.create({
    data: {
      technicianId: tech.id,
      workType,
      equipment,
      description,
      result: result as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ result, remaining: DAILY_LIMIT - usedToday - 1 });
}
