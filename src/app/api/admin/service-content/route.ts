import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { upsertServiceContent } from "@/lib/service-content-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const upsertSchema = z
  .object({
    serviceId: z.string().min(1),
    brandId: z.string().optional().nullable(),
    cityId: z.string().min(1),
    h1: z.string().min(5).max(160),
    metaTitle: z.string().max(160).optional().nullable(),
    metaDescription: z.string().max(300).optional().nullable(),
    body: z.string().min(50),
    source: z.enum(["MANUAL", "AI_GPT", "AI_CLAUDE", "TEMPLATE"]).default("MANUAL"),
    reviewed: z.boolean().optional(),
  })
  .strict();

// GET — admin lista todos los contenidos
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contents = await prisma.serviceContent.findMany({
    include: { service: true, brand: true, city: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ contents });
}

// POST/upsert — crea o actualiza por (serviceId, brandId, cityId)
export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const content = await upsertServiceContent(
      prisma,
      { serviceId: d.serviceId, brandId: d.brandId ?? null, cityId: d.cityId },
      {
        h1: d.h1,
        metaTitle: d.metaTitle ?? null,
        metaDescription: d.metaDescription ?? null,
        body: d.body,
        source: d.source,
        reviewed: d.reviewed ?? false,
      }
    );

    return NextResponse.json({ ok: true, content });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("[api/admin/service-content]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
