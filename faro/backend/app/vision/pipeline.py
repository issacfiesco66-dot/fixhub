"""Pipeline por fotograma: decodificar -> detectar (YOLO y/o VLM) -> política de alertas."""

from __future__ import annotations

import asyncio
import io
import logging
import time

from PIL import Image

from ..session.manager import Session
from .alert_policy import Alert
from .detector import Detector
from .hazards import Detection

log = logging.getLogger(__name__)


class VisionPipeline:
    def __init__(
        self,
        *,
        backend: str,
        detector: Detector | None,
        vlm,
        frame_min_interval_s: float = 0.25,
        vlm_interval_s: float = 4.0,
    ) -> None:
        self.backend = backend
        self.detector = detector
        self.vlm = vlm
        self.frame_min_interval_s = frame_min_interval_s
        self.vlm_interval_s = vlm_interval_s

    async def process(
        self, session: Session, jpeg: bytes, now: float | None = None
    ) -> Alert | None:
        now = time.monotonic() if now is None else now
        session.last_frame = jpeg
        session.last_frame_at = now
        if not session.alerts_enabled:
            return None
        if (
            session.last_processed_at is not None
            and now - session.last_processed_at < self.frame_min_interval_s
        ):
            return None
        session.last_processed_at = now

        try:
            image = Image.open(io.BytesIO(jpeg))
            image.load()
            image = image.convert("RGB")
        except Exception as exc:  # noqa: BLE001 - un fotograma corrupto no debe tirar la sesión
            log.warning("Fotograma inválido: %s", exc)
            return None

        detections: list[Detection] = []
        if self.detector is not None and self.backend in ("yolo", "hybrid", "fake"):
            loop = asyncio.get_running_loop()
            detections += await loop.run_in_executor(None, self.detector.detect, image)

        if self.vlm is not None and self.backend in ("vlm", "hybrid"):
            if self.backend == "vlm":
                if now - session.last_vlm_at >= self.vlm_interval_s:
                    session.last_vlm_at = now
                    session.vlm_cache = (now, await self.vlm.detect_hazards(image))
            else:
                task = session.vlm_task
                if (
                    task is None or task.done()
                ) and now - session.last_vlm_at >= self.vlm_interval_s:
                    session.last_vlm_at = now
                    session.vlm_task = asyncio.create_task(self._run_vlm(session, image, now))
            cache = session.vlm_cache
            if cache is not None and now - cache[0] <= self.vlm_interval_s * 1.5:
                detections += cache[1]

        return session.alert_policy.select(detections, now)

    async def _run_vlm(self, session: Session, image: Image.Image, frame_time: float) -> None:
        try:
            session.vlm_cache = (frame_time, await self.vlm.detect_hazards(image))
        except Exception:  # noqa: BLE001
            log.exception("El análisis VLM falló")
