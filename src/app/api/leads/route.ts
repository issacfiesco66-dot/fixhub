import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLeadSchema } from "@/lib/validators";
import { getCurrentTechnician } from "@/lib/auth";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { sendAdminLeadNotification, sendClientTrackingEmail } from "@/lib/email";
import { getPublicBaseUrl } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEAD_TTL_HOURS = 24;

// POST /api/leads — cliente final crea una petición.
// Rate limit: 3 leads por minuto por IP (anti-spam público — H-1 del audit).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`leads:${ip}`, 3, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl);

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
  });

  // En Vercel serverless no hay broker in-memory que sobreviva entre requests.
  // El dashboard del técnico hace polling cada 5s contra /api/leads/feed,
  // así que el lead recién creado lo verán en ≤5s automáticamente.

  const trackUrl = `${getPublicBaseUrl()}/solicitud/${lead.publicToken}`;

  // Notificación al admin por correo (best-effort — no rompe la respuesta).
  try {
    await sendAdminLeadNotification({
      service: service.name,
      brand: brand?.name ?? null,
      city: city.name,
      zone: zone?.name ?? null,
      urgency: data.urgency,
      failure: data.failure,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
    });
  } catch (e) {
    console.error("[leads] notificación admin falló:", e instanceof Error ? e.message : e);
  }

  // Email al cliente con su link de seguimiento (best-effort, si dejó correo).
  if (data.clientEmail) {
    try {
      await sendClientTrackingEmail({
        to: data.clientEmail,
        clientName: data.clientName,
        serviceName: service.name,
        trackUrl,
      });
    } catch (e) {
      console.error("[leads] email seguimiento falló:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      leadId: lead.id,
      trackUrl,
      message: "¡Listo! Te contactará un técnico verificado en minutos.",
    },
    { status: 201 }
  );
}

// GET /api/leads — requiere auth de técnico, devuelve solo leads en su cobertura.
// Cierra M-1 del audit (antes: cualquier anónimo veía el inventario completo).
export async function GET() {
  const tech = await getCurrentTechnician();
  if (!tech) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cityIds = tech.coverages.map((c) => c.cityId);
  const serviceIds = tech.services.map((s) => s.serviceId);
  if (cityIds.length === 0 || serviceIds.length === 0) {
    return NextResponse.json({ leads: [] });
  }

  const leads = await prisma.lead.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gt: new Date() },
      cityId: { in: cityIds },
      serviceId: { in: serviceIds },
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
