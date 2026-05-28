// GET /api/admin/scraper/status/[jobId] — proxy del estado del job en Railway.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.SCRAPER_SERVICE_URL;
  const token = process.env.SCRAPER_SERVICE_TOKEN;
  if (!url || !token) {
    return NextResponse.json({ error: "Scraper no configurado" }, { status: 503 });
  }

  const { jobId } = await params;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/scrape-status/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ error: "No se pudo contactar el servicio de scraping" }, { status: 502 });
  }
}
