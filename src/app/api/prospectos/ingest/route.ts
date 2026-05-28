// POST /api/prospectos/ingest — recibe prospects del scraper externo (servicio
// Python en Railway) y los guarda en el modelo Prospect (pipeline de outbound).
//
// Auth: Bearer INGEST_WEBHOOK_SECRET (comparación en tiempo constante). NO usa
// la sesión de admin — es máquina-a-máquina. El secret debe vivir en las env
// vars de FixHub Y del scraper.
//
// El teléfono es obligatorio para FixHub (el outbound es por WhatsApp): los
// prospects sin teléfono se omiten. Dedup por teléfono ya existente.

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ingestPayloadSchema } from "@/lib/validators";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Comparación en tiempo constante (evita timing side-channel sobre el secret).
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`ingest:${ip}`, 20, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  const secret = process.env.INGEST_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json(
      { error: "Servidor mal configurado: INGEST_WEBHOOK_SECRET ausente o < 32 chars." },
      { status: 500 }
    );
  }
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || !secretMatches(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ingestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }

  const source = parsed.data.source || "GoogleMaps_Scraper";
  let created = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const p of parsed.data.prospectos) {
    const phone = (p.telefono || "").trim();
    const digits = phone.replace(/\D/g, "");
    // Sin teléfono usable no sirve para outbound por WhatsApp → omitir.
    if (digits.length < 10) {
      skipped++;
      continue;
    }

    // Dedup por teléfono (cualquier fuente).
    const existing = await prisma.prospect.findFirst({
      where: { phone: { contains: digits.slice(-10) } },
      select: { id: true },
    });
    if (existing) {
      duplicates++;
      continue;
    }

    const notesParts = [p.categoria, p.direccion].filter(Boolean);
    try {
      await prisma.prospect.create({
        data: {
          name: p.nombre.trim(),
          phone,
          email: p.email?.trim() || null,
          city: (p.ciudad || "").trim() || "Sin ciudad",
          source,
          notes: notesParts.length ? notesParts.join(" · ") : null,
          status: "NEW",
        },
      });
      created++;
    } catch (e) {
      console.error("[ingest] error creando prospect:", e instanceof Error ? e.message : e);
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    summary: { total: parsed.data.prospectos.length, created, duplicates, skipped },
  });
}
