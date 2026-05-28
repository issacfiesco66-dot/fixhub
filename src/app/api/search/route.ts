// POST /api/search — buscador público.
//
// Dos modos:
//   - track=false (default): solo devuelve matches. Usado por autocomplete.
//   - track=true: persiste la query en ServiceSearch (upsert por
//     normalizedQuery+citySlug, incrementando count si ya existe).
//     Usado en submit final del buscador.
//
// La separación evita inflar la tabla con keystrokes de autocomplete.
// El cliente debe llamar track=true SOLO cuando el usuario "confirma" la
// búsqueda (enter, click en "Buscar", o submit del form de captura).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { normalizeQuery, matchServices } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const searchSchema = z
  .object({
    q: z.string().min(1).max(200),
    citySlug: z.string().max(80).optional(),
    track: z.boolean().optional().default(false),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(20).optional().or(z.literal("")),
    source: z.string().max(120).optional(),
  })
  .strict();

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  // Autocomplete dispara varias requests → 30/min es generoso pero acotado.
  const rl = await rateLimit(`search:${ip}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

  const body = await req.json().catch(() => null);
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { q, citySlug, track, email, phone, source } = parsed.data;

  const normalized = normalizeQuery(q);
  if (!normalized) {
    return NextResponse.json({ matches: [], hasMatch: false });
  }

  // Match contra el catálogo activo
  const matches = await matchServices(q, 5);
  const hasMatch = matches.length > 0;

  // Si trackeamos, resolvemos matchedServiceId del mejor match tipo "service"
  let matchedServiceId: string | null = null;
  if (track) {
    const bestService = matches.find((m) => m.type === "service");
    if (bestService) {
      const sv = await prisma.service.findUnique({
        where: { slug: bestService.slug },
        select: { id: true },
      });
      matchedServiceId = sv?.id ?? null;
    }

    const citySlugKey = citySlug ?? ""; // "" = sin ciudad — ver schema.prisma
    const userAgent = req.headers.get("user-agent")?.slice(0, 400) ?? null;

    try {
      await prisma.serviceSearch.upsert({
        where: {
          normalizedQuery_citySlug: {
            normalizedQuery: normalized,
            citySlug: citySlugKey,
          },
        },
        update: {
          count: { increment: 1 },
          lastSeenAt: new Date(),
          // Re-actualizar email/phone si el usuario los dejó esta vez
          // (puede haber pasado primero sin datos y ahora con datos)
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          // Actualizar matched/hasMatch — el catálogo puede haber cambiado
          matchedServiceId,
          hasMatch,
        },
        create: {
          rawQuery: q.trim(),
          normalizedQuery: normalized,
          citySlug: citySlugKey,
          matchedServiceId,
          hasMatch,
          email: email || null,
          phone: phone || null,
          source: source ?? null,
          ipHash: hashIp(ip),
          userAgent,
        },
      });
    } catch (e) {
      // No fallar la búsqueda si el tracking truena — el usuario igual debe
      // ver los matches. Log para auditar.
      console.error("[api/search] upsert ServiceSearch failed:", e);
    }
  }

  return NextResponse.json({ matches, hasMatch });
}
