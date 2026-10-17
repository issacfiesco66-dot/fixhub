"""Taxonomía de peligros, prioridades, estimación de distancia y redacción de alertas.

Las alertas son deliberadamente ultra cortas: "<peligro> <posición>, <distancia>".
Ejemplos: "Escalera bajando al frente, 2 metros" · "Cable al frente, arriba" ·
"Vehículo a la derecha, cerca".
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum


class HazardClass(StrEnum):
    STAIRS_DOWN = "stairs_down"
    STAIRS_UP = "stairs_up"
    HANGING_CABLE = "hanging_cable"
    POLE = "pole"
    POTHOLE = "pothole"
    CURB = "curb"
    VEHICLE = "vehicle"
    BICYCLE = "bicycle"
    PERSON = "person"
    ANIMAL = "animal"
    OBSTACLE = "obstacle"


# 0 = más urgente. Decide qué se anuncia primero cuando hay varios peligros.
PRIORITY: dict[HazardClass, int] = {
    HazardClass.VEHICLE: 0,
    HazardClass.STAIRS_DOWN: 1,
    HazardClass.POTHOLE: 1,
    HazardClass.HANGING_CABLE: 1,
    HazardClass.BICYCLE: 2,
    HazardClass.POLE: 2,
    HazardClass.STAIRS_UP: 2,
    HazardClass.CURB: 2,
    HazardClass.PERSON: 3,
    HazardClass.ANIMAL: 3,
    HazardClass.OBSTACLE: 3,
}

LABEL_ES: dict[HazardClass, str] = {
    HazardClass.STAIRS_DOWN: "Escalera bajando",
    HazardClass.STAIRS_UP: "Escalera subiendo",
    HazardClass.HANGING_CABLE: "Cable",
    HazardClass.POLE: "Poste",
    HazardClass.POTHOLE: "Bache",
    HazardClass.CURB: "Escalón",
    HazardClass.VEHICLE: "Vehículo",
    HazardClass.BICYCLE: "Bicicleta",
    HazardClass.PERSON: "Persona",
    HazardClass.ANIMAL: "Animal",
    HazardClass.OBSTACLE: "Obstáculo",
}

# Clases COCO (modelo YOLOv8 base) -> clase de peligro. COCO no incluye escaleras, cables,
# postes ni baches: esas vienen del modelo fine-tuned (training/) o del VLM.
COCO_TO_HAZARD: dict[str, HazardClass] = {
    "car": HazardClass.VEHICLE,
    "truck": HazardClass.VEHICLE,
    "bus": HazardClass.VEHICLE,
    "motorcycle": HazardClass.VEHICLE,
    "train": HazardClass.VEHICLE,
    "bicycle": HazardClass.BICYCLE,
    "person": HazardClass.PERSON,
    "dog": HazardClass.ANIMAL,
    "cat": HazardClass.ANIMAL,
    "horse": HazardClass.ANIMAL,
    "parking meter": HazardClass.POLE,
    "stop sign": HazardClass.POLE,
    "fire hydrant": HazardClass.OBSTACLE,
    "bench": HazardClass.OBSTACLE,
    "potted plant": HazardClass.OBSTACLE,
    "chair": HazardClass.OBSTACLE,
    "suitcase": HazardClass.OBSTACLE,
}

# Clases del modelo fine-tuned (training/hazards.yaml). Sus nombres coinciden con HazardClass.
CUSTOM_CLASS_NAMES: tuple[str, ...] = (
    "stairs_down",
    "stairs_up",
    "hanging_cable",
    "pole",
    "pothole",
    "curb",
)

# Altura real típica (m) para estimar distancia monocular con el modelo pinhole.
TYPICAL_HEIGHT_M: dict[str, float] = {
    "person": 1.70,
    "car": 1.50,
    "truck": 3.00,
    "bus": 3.20,
    "motorcycle": 1.10,
    "bicycle": 1.05,
    "dog": 0.55,
    "cat": 0.30,
    "fire hydrant": 0.75,
    "bench": 0.90,
    "chair": 0.90,
    "parking meter": 1.40,
    "potted plant": 0.60,
    "stop sign": 2.20,
}

POSITION_ES: dict[str, str] = {
    "left": "a la izquierda",
    "center": "al frente",
    "right": "a la derecha",
}


@dataclass
class BBox:
    """Caja normalizada (0..1) relativa al tamaño de la imagen."""

    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def center_x(self) -> float:
        return (self.x1 + self.x2) / 2.0

    @property
    def center_y(self) -> float:
        return (self.y1 + self.y2) / 2.0

    @property
    def width(self) -> float:
        return max(0.0, self.x2 - self.x1)

    @property
    def height(self) -> float:
        return max(0.0, self.y2 - self.y1)

    @property
    def area(self) -> float:
        return self.width * self.height


@dataclass
class Detection:
    hazard: HazardClass
    confidence: float
    bbox: BBox
    source: str = "yolo"  # yolo | vlm
    label: str = ""  # nombre de clase original del modelo
    distance_m: float | None = None  # métrica si se pudo estimar

    @property
    def zone(self) -> str:
        return horizontal_zone(self.bbox.center_x)

    @property
    def vertical(self) -> str:
        return vertical_zone(self.bbox.center_y)


def horizontal_zone(center_x: float) -> str:
    if center_x < 0.35:
        return "left"
    if center_x > 0.65:
        return "right"
    return "center"


def vertical_zone(center_y: float) -> str:
    if center_y < 0.33:
        return "top"
    if center_y < 0.66:
        return "middle"
    return "bottom"


def focal_length_px(image_width_px: int, horizontal_fov_deg: float) -> float:
    """Distancia focal en píxeles a partir del campo de visión horizontal."""
    return (image_width_px / 2.0) / math.tan(math.radians(horizontal_fov_deg) / 2.0)


def estimate_distance_m(
    label: str, bbox_height_norm: float, image_height_px: int, focal_px: float
) -> float | None:
    """Distancia monocular: d = H_real * f / h_px. None si la clase no tiene altura conocida."""
    real_h = TYPICAL_HEIGHT_M.get(label)
    if real_h is None or bbox_height_norm <= 0.01:
        return None
    pixel_h = bbox_height_norm * image_height_px
    return round(real_h * focal_px / pixel_h, 1)


def qualitative_distance_m(area_fraction: float) -> float:
    """Distancia aproximada por tamaño aparente cuando no hay altura real de referencia."""
    if area_fraction >= 0.20:
        return 1.0
    if area_fraction >= 0.06:
        return 3.0
    if area_fraction >= 0.02:
        return 6.0
    return 12.0


def effective_distance_m(det: Detection) -> float:
    if det.distance_m is not None:
        return det.distance_m
    return qualitative_distance_m(det.bbox.area)


def distance_phrase_es(distance_m: float | None, *, metric: bool) -> str:
    if distance_m is None:
        return ""
    if distance_m < 1.5:
        return "muy cerca"
    if not metric:
        return "cerca" if distance_m <= 3.0 else ""
    n = max(1, round(distance_m))
    return "1 metro" if n == 1 else f"{n} metros"


def alert_text_es(det: Detection) -> str:
    """Frase de alerta ultra corta: '<peligro> <posición>[, arriba][, <distancia>]'."""
    parts = [f"{LABEL_ES[det.hazard]} {POSITION_ES[det.zone]}"]
    if det.hazard is HazardClass.HANGING_CABLE and det.vertical == "top":
        parts.append("arriba")
    dist = distance_phrase_es(effective_distance_m(det), metric=det.distance_m is not None)
    if dist:
        parts.append(dist)
    return ", ".join(parts)
