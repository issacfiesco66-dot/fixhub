import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broker, type LeadAlertPayload } from "@/lib/realtime";
import { createLeadSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEAD_TTL_HOURS = 24;

// POST /api/leads — cliente final crea una petición.
// Dispara la alerta a TODOS los técnicos en (ciudad × servicio).
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Resolución de slugs → IDs (un trip a DB, paralelo)
  const [service, city, brand, zone] = await Promise.all([
    prisma.service.findUnique({ where: { slug: data.serviceSlug } }),
    prisma.city.findUnique({ where: { slug: data.citySlug } }),
    data.brandSlug
      ? prisma.brand.findUnique({ where: { slug: data.brandSlug } })
      : Promise.resolve(null),
    data.zoneSlug && data.citySlug
      ? prisma.zone.findFirst({
          where: { slug: data.zoneSlug, city: { slug: data.citySlug } },
        })
      : Promise.resolve(null),
  ]);

  if (!service) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  if (!city) return NextResponse.json({ error: "Ciudad no encontrada" }, { status: 404 });
  if (service.requiresBrand && !brand) {
    return NextResponse.json({ error: "Este servicio requiere marca" }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    data: {
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      clientEmail: data.clientEmail || null,
      serviceId: service.id,
      brandId: brand?.id,
      cityId: city.id,
      zoneId: zone?.id,
      addressHint: data.addressHint,
      failure: data.failure,
      urgency: data.urgency,
      price: service.basePrice,
      source: data.source,
      expiresAt: new Date(Date.now() + LEAD_TTL_HOURS * 60 * 60 * 1000),
    },
    include: { service: true, brand: true, city: true, zone: true },
  });

  // Broadcast en tiempo real (no bloquea la respuesta — fire & forget seguro)
  const channel = broker.channelOf(city.id, service.id);
  const viewers = broker.viewerCount(channel);
  const payload: LeadAlertPayload = {
    type: "NEW_LEAD",
    leadId: lead.id,
    service: service.name,
    serviceSlug: service.slug,
    brand: brand?.name ?? null,
    city: city.name,
    zone: zone?.name ?? null,
    failure: lead.failure,
    urgency: lead.urgency,
    price: lead.price,
    // FOMO: como mínimo 2, como máximo viewers reales + 1 — "X técnicos más viendo"
    viewersHint: Math.max(2, viewers + 1),
    expiresAt: lead.expiresAt.toISOString(),
    createdAt: lead.createdAt.toISOString(),
  };
  broker.publish(channel, payload);

  return NextResponse.json(
    {
      ok: true,
      leadId: lead.id,
      message: "¡Listo! Te contactará un técnico verificado en minutos.",
    },
    { status: 201 }
  );
}

// GET /api/leads?status=PENDING&cityId=...&serviceId=...
// Lista para el dashboard del técnico (lo que ya hay en su zona).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cityIds = sp.getAll("cityId");
  const serviceIds = sp.getAll("serviceId");

  const leads = await prisma.lead.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gt: new Date() },
      ...(cityIds.length ? { cityId: { in: cityIds } } : {}),
      ...(serviceIds.length ? { serviceId: { in: serviceIds } } : {}),
    },
    select: {
      id: true,
      failure: true,
      urgency: true,
      price: true,
      createdAt: true,
      expiresAt: true,
      addressHint: true,
      service: { select: { name: true, slug: true } },
      brand: { select: { name: true } },
      city: { select: { name: true } },
      zone: { select: { name: true } },
      // Datos del cliente OCULTOS hasta compra
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ leads });
}
