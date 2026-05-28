# FixHub Scraper Service

Microservicio Python (FastAPI + Playwright) que scrapea Google Maps y postea
los resultados al endpoint de ingest de FixHub. Corre en **Railway** (no en
Vercel — usa navegador headless y jobs largos). Adaptado del scraper de Indexa:
sin Firebase/Firestore; auth por token y envío vía HTTP a FixHub.

## Cómo funciona
1. FixHub (`/admin/scraper`) → `POST /scrape-async` con `{query, max, token}`.
2. Este servicio corre `scraper_indexa.py` (Chromium headless) y por cada lote
   hace `POST {FIXHUB_INGEST_URL}` con `Authorization: Bearer {INGEST_WEBHOOK_SECRET}`.
3. FixHub deduplica por teléfono y crea los `Prospect`.
4. FixHub poll `GET /scrape-status/{job_id}` para el progreso.

## Deploy en Railway
1. **New Project / Service → Deploy from GitHub repo** → `issacfiesco66-dot/fixhub`.
2. Service → **Settings → Root Directory** = `scraper-service` (Railway detecta el `Dockerfile`).
3. **Settings → Networking → Generate Domain** (puerto **8000**) → te da la URL pública `*.up.railway.app`.
4. **Variables** (en Railway):
   - `SCRAPER_SERVICE_TOKEN` — token compartido con Vercel (≥16 chars)
   - `FIXHUB_INGEST_URL` = `https://fixhub-sigma.vercel.app/api/prospectos/ingest`
   - `INGEST_WEBHOOK_SECRET` — el mismo que en Vercel (≥32 chars)
   - `CORS_ORIGINS` = `https://fixhub-sigma.vercel.app`

## En Vercel (proyecto FixHub) — env vars
- `SCRAPER_SERVICE_URL` = la URL pública de Railway (sin `/` final)
- `SCRAPER_SERVICE_TOKEN` = el mismo que en Railway
- `INGEST_WEBHOOK_SECRET` = el mismo que en Railway
Luego **redeploy** de FixHub.

## Verificar
- `GET https://<railway-url>/health` → `{"status":"ok","token_configured":true,"ingest_configured":true}`
- Desde `/admin/scraper` en FixHub: probar "reparación de electrodomésticos" + "Ciudad de México".

## Nota
El navegador headless consume RAM (~512MB-1GB por job). Usá un plan de Railway
con memoria suficiente. Scrapear Google Maps puede violar sus ToS — usar con criterio.
