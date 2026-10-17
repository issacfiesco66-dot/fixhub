"""Política de alertas: prioriza, filtra por distancia y evita repetir (cooldown).

Objetivo: no abrumar al usuario. Reglas:
  * Se anuncia como máximo UN peligro por fotograma, el más urgente y cercano.
  * Un mismo (peligro, zona) no se repite durante `cooldown_s`, salvo que se esté acercando
    (distancia < 70 % de la anterior).
  * Entre dos alertas cualesquiera pasan al menos `min_interval_s`, excepto prioridad 0
    (vehículo), que puede interrumpir.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from .hazards import PRIORITY, Detection, HazardClass, alert_text_es, effective_distance_m


@dataclass
class Alert:
    text: str
    hazard: HazardClass
    priority: int
    zone: str
    distance_m: float | None
    interrupt: bool  # True: debe cortar cualquier voz en curso

    def to_message(self) -> dict:
        return {
            "type": "alert",
            "text": self.text,
            "priority": self.priority,
            "hazard": self.hazard.value,
            "zone": self.zone,
            "distance_m": self.distance_m,
            "interrupt": self.interrupt,
        }


class AlertPolicy:
    def __init__(
        self,
        *,
        cooldown_s: float = 3.0,
        min_interval_s: float = 1.2,
        max_distance_m: float = 8.0,
        vehicle_max_distance_m: float = 15.0,
    ) -> None:
        self.cooldown_s = cooldown_s
        self.min_interval_s = min_interval_s
        self.max_distance_m = max_distance_m
        self.vehicle_max_distance_m = vehicle_max_distance_m
        self._last_by_key: dict[tuple[HazardClass, str], tuple[float, float]] = {}
        self._last_alert_at: float | None = None

    def reset(self) -> None:
        self._last_by_key.clear()
        self._last_alert_at = None

    def is_relevant(self, det: Detection) -> bool:
        limit = (
            self.vehicle_max_distance_m
            if det.hazard is HazardClass.VEHICLE
            else self.max_distance_m
        )
        return effective_distance_m(det) <= limit

    @staticmethod
    def rank(det: Detection) -> tuple[int, float, float]:
        return (PRIORITY[det.hazard], effective_distance_m(det), -det.confidence)

    def select(self, detections: list[Detection], now: float | None = None) -> Alert | None:
        now = time.monotonic() if now is None else now
        candidates = sorted((d for d in detections if self.is_relevant(d)), key=self.rank)
        for det in candidates:
            key = (det.hazard, det.zone)
            dist = effective_distance_m(det)
            last = self._last_by_key.get(key)
            if last is not None:
                last_t, last_d = last
                approaching = dist < last_d * 0.7
                if now - last_t < self.cooldown_s and not approaching:
                    continue
            priority = PRIORITY[det.hazard]
            if (
                self._last_alert_at is not None
                and now - self._last_alert_at < self.min_interval_s
                and priority > 0
            ):
                return None  # demasiado pronto; se reintenta en el siguiente fotograma
            self._last_by_key[key] = (now, dist)
            self._last_alert_at = now
            return Alert(
                text=alert_text_es(det),
                hazard=det.hazard,
                priority=priority,
                zone=det.zone,
                distance_m=det.distance_m,
                interrupt=priority <= 1,
            )
        return None
