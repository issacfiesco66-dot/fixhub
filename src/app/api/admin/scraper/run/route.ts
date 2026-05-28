// POST /api/admin/scraper/run — proxy admin → servicio de scraping en Railway.
// FixHub controla el acceso (getCurrentAdmin); al servicio externo le pasa el
// SCRAPER_SERVICE_TOKEN. El scraper, al terminar, postea los prospects a
// /api/prospectos/ingest. Si el servicio no está configurado, responde 503.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.SCRAPER_SERVICE_URL;
  const token = process.env.SCRAPER_SERVICE_TOKEN;
  if (!url || !token) {
    return NextResponse.json(
      { error: "Scraper no configurado. Falta SCRAPER_SERVICE_URL / SCRAPER_SERVICE_TOKEN en las env vars." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const servicio = String(body.servicio || "").trim();
  const ciudad = String(body.ciudad || "").trim();
  const max = Math.min(Math.max(parseInt(String(body.max), 10) || 30, 1), 50);
  if (!servicio || !ciudad) {
    return NextResponse.json({ error: "Servicio y ciudad son requeridos" }, { status: 400 });
  }

  const query = `${servicio} en ${ciudad}`;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/scrape-async`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, max, token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data.detail || data.error || "Error del servicio de scraping" }, { status: 502 });
    }
    return NextResponse.json({ jobId: data.job_id, query, max });
  } catch {
    return NextResponse.json({ error: "No se pudo contactar el servicio de scraping" }, { status: 502 });
  }
}
