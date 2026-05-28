"""
FixHub Scraper Service — wrapper FastAPI para Railway.

Corre scraper_indexa.py (navegador headless que scrapea Google Maps) como
subprocess, con jobs async + polling. El scraper postea los resultados al
endpoint /api/prospectos/ingest de FixHub.

Auth: SCRAPER_SERVICE_TOKEN (Bearer header o campo `token` del body). NO usa
Firebase. FixHub controla el acceso del admin y proxea con este token.
"""

import asyncio
import hmac
import json
import os
import time
import uuid
from pathlib import Path

import logging

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger("fixhub_scraper_service")
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(message)s")

app = FastAPI(title="FixHub Scraper Service")

BUILD_VERSION = "2026-05-28-fixhub-v1"
_BOOT_TIME = time.time()

SERVICE_TOKEN = os.getenv("SCRAPER_SERVICE_TOKEN", "")
ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "https://fix-hub.company,https://www.fix-hub.company,http://localhost:3000,http://localhost:3100",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

SCRIPT_DIR = Path(__file__).resolve().parent
SCRAPER_SCRIPT = SCRIPT_DIR / "scraper_indexa.py"

# Job store en memoria (últimos N).
_jobs: dict[str, dict] = {}
MAX_JOBS = 20


def token_ok(provided: str) -> bool:
    """Comparación en tiempo constante contra SCRAPER_SERVICE_TOKEN."""
    if not SERVICE_TOKEN or len(SERVICE_TOKEN) < 16:
        return False
    return hmac.compare_digest(provided or "", SERVICE_TOKEN)


def _cleanup_old_jobs():
    if len(_jobs) <= MAX_JOBS:
        return
    sorted_ids = sorted(_jobs.keys(), key=lambda k: _jobs[k].get("created", 0))
    while len(_jobs) > MAX_JOBS:
        del _jobs[sorted_ids.pop(0)]


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "fixhub-scraper",
        "version": BUILD_VERSION,
        "uptime_s": int(time.time() - _BOOT_TIME),
        "token_configured": bool(SERVICE_TOKEN and len(SERVICE_TOKEN) >= 16),
        "ingest_configured": bool(os.getenv("FIXHUB_INGEST_URL") and os.getenv("INGEST_WEBHOOK_SECRET")),
    }


class ScrapeRequest(BaseModel):
    query: str
    max: int = 30
    token: str = ""


async def _run_scrape_job(job_id: str, query: str, max_results: int):
    """Corre scraper_indexa.py como subprocess y recoge los eventos JSON."""
    job = _jobs[job_id]
    try:
        args = [
            "python", str(SCRAPER_SCRIPT),
            query,
            "--max", str(max_results),
            "--headless", "true",
            "--json-progress",
        ]
        logger.info(f"[job:{job_id}] Start: {query} (max={max_results})")

        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(SCRIPT_DIR),
        )

        buffer = ""
        while True:
            try:
                chunk = await asyncio.wait_for(proc.stdout.read(4096), timeout=300)
            except asyncio.TimeoutError:
                job["status"] = "error"
                job["error"] = "Timeout: el scraper tardó más de 5 min sin enviar datos."
                proc.kill()
                break
            if not chunk:
                break
            buffer += chunk.decode("utf-8", errors="replace")
            lines = buffer.split("\n")
            buffer = lines.pop()
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                try:
                    evt = json.loads(line)
                    if evt.get("progress") is not None:
                        job["progress"] = evt["progress"]
                    if evt.get("message"):
                        job["message"] = evt["message"]
                    if evt.get("event") == "done":
                        job["result"] = evt
                    job["log"].append(evt.get("message", line)[:200])
                    if len(job["log"]) > 30:
                        job["log"] = job["log"][-30:]
                except (json.JSONDecodeError, ValueError):
                    pass

        if buffer.strip():
            try:
                evt = json.loads(buffer.strip())
                if evt.get("event") == "done":
                    job["result"] = evt
                if evt.get("progress") is not None:
                    job["progress"] = evt["progress"]
            except (json.JSONDecodeError, ValueError):
                pass

        try:
            stderr_data = await asyncio.wait_for(proc.stderr.read(), timeout=5)
            if stderr_data:
                job["stderr"] = stderr_data.decode("utf-8", errors="replace").strip()[-500:]
        except asyncio.TimeoutError:
            pass

        await proc.wait()
        job["exit_code"] = proc.returncode
        if job["status"] != "error":
            if proc.returncode == 0:
                job["status"] = "done"
                job["progress"] = 100
            else:
                job["status"] = "error"
                job["error"] = job.get("stderr", f"Exit code {proc.returncode}")[:300]
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)[:300]
        logger.error(f"[job:{job_id}] Exception: {e}")
    job["finished_at"] = time.time()


@app.post("/scrape-async")
async def scrape_async(body: ScrapeRequest, authorization: str = Header("")):
    header_token = authorization[7:] if authorization.startswith("Bearer ") else authorization
    if not (token_ok(header_token) or token_ok(body.token)):
        raise HTTPException(status_code=403, detail="Token inválido.")

    if not SCRAPER_SCRIPT.exists():
        raise HTTPException(status_code=500, detail="scraper_indexa.py no encontrado.")

    query = (body.query or "").strip()
    if not query or len(query) > 120:
        raise HTTPException(status_code=400, detail="query inválido (1-120 caracteres).")

    effective_max = min(max(body.max, 1), 50)
    job_id = uuid.uuid4().hex[:12]
    _jobs[job_id] = {
        "status": "running", "query": query, "max": effective_max,
        "progress": 0, "message": "Iniciando scraper...", "log": [],
        "result": None, "error": None, "stderr": None, "exit_code": None,
        "created": time.time(), "finished_at": None,
    }
    _cleanup_old_jobs()
    asyncio.create_task(_run_scrape_job(job_id, query, effective_max))
    return {"job_id": job_id, "status": "running", "max": effective_max}


@app.get("/scrape-status/{job_id}")
async def scrape_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado (el servicio pudo reiniciarse). Reintenta.")
    return {
        "job_id": job_id, "status": job["status"], "progress": job["progress"],
        "message": job["message"], "log": job["log"], "result": job["result"],
        "error": job["error"], "exit_code": job["exit_code"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
