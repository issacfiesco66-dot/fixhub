import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { generateServiceContent } from "@/lib/ai-content";
import { findServiceContent, upsertServiceContent } from "@/lib/service-content-store";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z
  .object({
    serviceId: z.string().min(1),
    brandId: z.string().nullable().optional(),
    cityId: z.string().min(1),
    force: z.boolean().optional(),
  })
  .strict();

// POST /api/admin/seo/generate
// Body: { serviceId, brandId?, cityId, force? }
// Genera contenido único via OpenAI y lo guarda. Devuelve el ServiceContent.
//
// IMPORTANTE: todo el cuerpo va envuelto en try/catch que devuelve JSON,
// para que el frontend NUNCA reciba un body vacío (que causa "Unexpected
// end of JSON input" al hacer .json()).
export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Rate limit: 30 generaciones por minuto por admin — protege gasto OpenAI
    // si la sesión admin es comprometida y se usa para spamear (H-4 del audit).
    const rl = await rateLimit(`seo-gen:${admin.id}:${getClientIp(req)}`, 30, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { serviceId, brandId, cityId, force } = parsed.data;
    const normalizedBrandId = brandId ?? null;
    const ids = { serviceId, brandId: normalizedBrandId, cityId };

    // Cargar la tupla con todos los datos que necesita el prompt
    const [service, city, brand, existing] = await Promise.all([
      prisma.service.findUnique({ where: { id: serviceId } }),
      prisma.city.findUnique({
        where: { id: cityId },
        include: { state: true, zones: true },
      }),
      normalizedBrandId ? prisma.brand.findUnique({ where: { id: normalizedBrandId } }) : null,
      findServiceContent(prisma, ids),
    ]);

    if (!service) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
    if (!city) return NextResponse.json({ error: "Ciudad no encontrada" }, { status: 404 });
    if (normalizedBrandId && !brand) {
      return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });
    }

    // Idempotencia
    if (existing && !force) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "ALREADY_EXISTS",
        content: existing,
      });
    }

    // Generar
    const generated = await generateServiceContent({
      serviceName: service.name,
      brandName: brand?.name ?? null,
      cityName: city.name,
      stateName: city.state.name,
      zones: city.zones.map((z) => z.name),
    });

    const saved = await upsertServiceContent(prisma, ids, {
      h1: generated.h1,
      metaDescription: generated.metaDescription,
      body: generated.body,
      source: "AI_GPT",
      reviewed: false,
    });

    return NextResponse.json({ ok: true, content: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("[api/admin/seo/generate]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
