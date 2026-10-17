"""Detector de objetos: YOLOv8 (ultralytics, carga perezosa) + detector falso para tests/dev."""

from __future__ import annotations

import logging
from typing import Protocol

from PIL import Image

from .hazards import (
    COCO_TO_HAZARD,
    CUSTOM_CLASS_NAMES,
    BBox,
    Detection,
    HazardClass,
    estimate_distance_m,
    focal_length_px,
)

log = logging.getLogger(__name__)


class Detector(Protocol):
    def detect(self, image: Image.Image) -> list[Detection]: ...


class YoloDetector:
    """Ejecuta el modelo COCO base y, si existe, el modelo fine-tuned de peligros de acera."""

    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        hazard_model_path: str = "",
        *,
        confidence: float = 0.35,
        horizontal_fov_deg: float = 100.0,
        imgsz: int = 640,
    ) -> None:
        try:
            from ultralytics import YOLO
        except ImportError as exc:  # pragma: no cover - depende del entorno
            raise RuntimeError(
                "ultralytics no está instalado. Ejecuta: pip install -e '.[vision]'"
            ) from exc
        self.base = YOLO(model_path)
        self.hazard = YOLO(hazard_model_path) if hazard_model_path else None
        self.confidence = confidence
        self.horizontal_fov_deg = horizontal_fov_deg
        self.imgsz = imgsz
        log.info("YOLO cargado: base=%s hazards=%s", model_path, hazard_model_path or "-")

    def detect(self, image: Image.Image) -> list[Detection]:
        width, height = image.size
        focal = focal_length_px(width, self.horizontal_fov_deg)
        detections: list[Detection] = []
        for model, source in ((self.base, "coco"), (self.hazard, "custom")):
            if model is None:
                continue
            results = model.predict(image, conf=self.confidence, imgsz=self.imgsz, verbose=False)
            if not results:
                continue
            result = results[0]
            boxes = result.boxes
            if boxes is None:
                continue
            names = result.names
            for i in range(len(boxes)):
                cls_name = str(names[int(boxes.cls[i])])
                hazard = self._map_class(cls_name, source)
                if hazard is None:
                    continue
                x1, y1, x2, y2 = (float(v) for v in boxes.xyxyn[i].tolist())
                bbox = BBox(x1, y1, x2, y2)
                detections.append(
                    Detection(
                        hazard=hazard,
                        confidence=float(boxes.conf[i]),
                        bbox=bbox,
                        source="yolo",
                        label=cls_name,
                        distance_m=estimate_distance_m(cls_name, bbox.height, height, focal),
                    )
                )
        return detections

    @staticmethod
    def _map_class(name: str, source: str) -> HazardClass | None:
        if source == "custom":
            return HazardClass(name) if name in CUSTOM_CLASS_NAMES else None
        return COCO_TO_HAZARD.get(name)


class FakeDetector:
    """Devuelve detecciones predefinidas. Para tests y para desarrollar la app sin GPU."""

    def __init__(self) -> None:
        self._queue: list[list[Detection]] = []
        self.calls = 0

    def queue(self, *batches: list[Detection]) -> None:
        self._queue.extend(batches)

    def detect(self, image: Image.Image) -> list[Detection]:
        self.calls += 1
        return self._queue.pop(0) if self._queue else []
