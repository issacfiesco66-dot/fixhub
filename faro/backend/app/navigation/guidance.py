"""Guía paso a paso optimizada para personas ciegas.

En lugar de "gira a la izquierda en Av. Reforma" sin más, combina:
  * referencias de brújula ("camina 80 metros hacia el norte"),
  * preaviso de maniobra ("en 20 metros, gira a la derecha"),
  * corrección de rumbo si el usuario se desvía de la dirección correcta,
  * detección de salida de ruta (recalcular) y llegada con posición tipo reloj.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from .geo import (
    LatLon,
    cardinal_es,
    clock_position_es,
    distance_to_polyline_m,
    haversine_m,
    initial_bearing_deg,
    relative_angle,
    round_to,
    turn_phrase_es,
)
from .google_maps import Route, RouteStep

MANEUVER_ES: dict[str, str] = {
    "TURN_LEFT": "gira a la izquierda",
    "TURN_RIGHT": "gira a la derecha",
    "TURN_SLIGHT_LEFT": "gira ligeramente a la izquierda",
    "TURN_SLIGHT_RIGHT": "gira ligeramente a la derecha",
    "TURN_SHARP_LEFT": "gira cerrado a la izquierda",
    "TURN_SHARP_RIGHT": "gira cerrado a la derecha",
    "UTURN_LEFT": "da media vuelta",
    "UTURN_RIGHT": "da media vuelta",
    "STRAIGHT": "sigue recto",
    "NAME_CHANGE": "continúa recto",
    "DEPART": "comienza",
    "MERGE": "incorpórate",
    "RAMP_LEFT": "mantente a la izquierda",
    "RAMP_RIGHT": "mantente a la derecha",
    "FORK_LEFT": "mantente a la izquierda",
    "FORK_RIGHT": "mantente a la derecha",
    "ROUNDABOUT_LEFT": "toma la rotonda",
    "ROUNDABOUT_RIGHT": "toma la rotonda",
    "FERRY": "toma el ferry",
}


@dataclass
class GuidanceEvent:
    kind: str  # start | instruction | progress | correction | reroute | arrived
    text: str
    priority: int = 2

    def to_message(self) -> dict:
        return {"type": "nav", "event": self.kind, "text": self.text, "priority": self.priority}


def _cap(text: str) -> str:
    return text[:1].upper() + text[1:] if text else text


def short_maneuver(step: RouteStep) -> str:
    phrase = MANEUVER_ES.get(step.maneuver)
    if phrase:
        return phrase
    if step.instruction:
        return step.instruction[:1].lower() + step.instruction[1:]
    return "continúa"


def full_maneuver(step: RouteStep) -> str:
    text = step.instruction.rstrip(".") if step.instruction else _cap(short_maneuver(step))
    return _cap(text)


def step_bearing(step: RouteStep) -> float:
    pts = step.polyline
    if len(pts) >= 2:
        return initial_bearing_deg(pts[0], pts[1])
    return initial_bearing_deg(step.start.as_tuple(), step.end.as_tuple())


def step_sentence(step: RouteStep) -> str:
    text = full_maneuver(step)
    if step.distance_m >= 5:
        heading = cardinal_es(step_bearing(step))
        text += f". Camina {round_to(step.distance_m)} metros hacia el {heading}"
    return text + "."


class RouteGuide:
    def __init__(
        self,
        route: Route,
        label: str,
        *,
        reroute_threshold_m: float = 25.0,
        arrival_radius_m: float = 10.0,
        maneuver_radius_m: float = 8.0,
        progress_every_m: float = 40.0,
        correction_threshold_deg: float = 35.0,
        offroute_hits_required: int = 3,
        clock=time.monotonic,
    ) -> None:
        self.route = route
        self.label = label
        self.reroute_threshold_m = reroute_threshold_m
        self.arrival_radius_m = arrival_radius_m
        self.maneuver_radius_m = maneuver_radius_m
        self.progress_every_m = progress_every_m
        self.correction_threshold_deg = correction_threshold_deg
        self.offroute_hits_required = offroute_hits_required
        self._clock = clock
        self.step_idx = 0
        self.finished = False
        self._preannounced: set[int] = set()
        self._final_preannounced = False
        self._offroute_hits = 0
        self._deviating_since: float | None = None
        self._last_correction_at = float("-inf")
        self._progress_anchor: LatLon | None = None

    @property
    def steps(self) -> list[RouteStep]:
        return self.route.steps

    @property
    def current_step(self) -> RouteStep:
        return self.steps[self.step_idx]

    def start_text(self, heading_deg: float | None = None) -> str:
        first = self.steps[0]
        total = round_to(self.route.distance_m, 10)
        minutes = max(1, round(self.route.duration_s / 60))
        parts = [f"Ruta a {self.label}: {total} metros, unos {minutes} minutos."]
        bearing = step_bearing(first)
        if heading_deg is not None:
            delta = relative_angle(heading_deg, bearing)
            if abs(delta) > self.correction_threshold_deg:
                parts.append(f"Primero {turn_phrase_es(delta)}.")
        parts.append(f"Camina {round_to(first.distance_m)} metros hacia el {cardinal_es(bearing)}.")
        return " ".join(parts)

    def remaining_m(self, pos: LatLon) -> float:
        rem = haversine_m(pos, self.current_step.end.as_tuple())
        rem += sum(s.distance_m for s in self.steps[self.step_idx + 1 :])
        return rem

    def update(
        self, lat: float, lon: float, heading_deg: float | None = None, now: float | None = None
    ) -> list[GuidanceEvent]:
        now = self._clock() if now is None else now
        if self.finished:
            return []
        pos: LatLon = (lat, lon)
        dest = self.route.destination.as_tuple()

        d_dest = haversine_m(pos, dest)
        if d_dest <= self.arrival_radius_m:
            self.finished = True
            text = f"Has llegado a {self.label}."
            if heading_deg is not None:
                delta = relative_angle(heading_deg, initial_bearing_deg(pos, dest))
                text += f" El destino está {clock_position_es(delta)}."
            return [GuidanceEvent("arrived", text, priority=1)]

        dist_route, seg_idx, _ = distance_to_polyline_m(pos, self.route.polyline)
        if dist_route > self.reroute_threshold_m:
            self._offroute_hits += 1
            if self._offroute_hits >= self.offroute_hits_required:
                self._offroute_hits = 0
                return [GuidanceEvent("reroute", "Te has desviado de la ruta. Recalculando.", 1)]
            return []
        self._offroute_hits = 0

        events: list[GuidanceEvent] = []
        step = self.current_step
        d_end = haversine_m(pos, step.end.as_tuple())
        while self.step_idx < len(self.steps) - 1 and d_end <= self.maneuver_radius_m:
            self.step_idx += 1
            step = self.current_step
            events.append(GuidanceEvent("instruction", step_sentence(step), priority=1))
            self._progress_anchor = pos
            self._deviating_since = None
            d_end = haversine_m(pos, step.end.as_tuple())
        if events:
            return events

        if self.step_idx < len(self.steps) - 1:
            if self.step_idx not in self._preannounced and 15 < d_end <= 30:
                self._preannounced.add(self.step_idx)
                nxt = self.steps[self.step_idx + 1]
                return [
                    GuidanceEvent(
                        "instruction", f"En {round_to(d_end)} metros, {short_maneuver(nxt)}.", 2
                    )
                ]
        elif not self._final_preannounced and 15 < d_dest <= 30:
            self._final_preannounced = True
            return [
                GuidanceEvent(
                    "instruction", f"En {round_to(d_dest)} metros llegas a tu destino.", 2
                )
            ]

        if heading_deg is not None and d_end > 12:
            target = self._next_waypoint(seg_idx)
            delta = relative_angle(heading_deg, initial_bearing_deg(pos, target))
            if abs(delta) > self.correction_threshold_deg:
                if self._deviating_since is None:
                    self._deviating_since = now
                elif now - self._deviating_since >= 3.0 and now - self._last_correction_at >= 8.0:
                    self._last_correction_at = now
                    self._deviating_since = None
                    return [
                        GuidanceEvent(
                            "correction", f"{_cap(turn_phrase_es(delta))} para seguir la ruta.", 2
                        )
                    ]
            else:
                self._deviating_since = None

        if self._progress_anchor is None:
            self._progress_anchor = pos
        elif haversine_m(pos, self._progress_anchor) >= self.progress_every_m:
            self._progress_anchor = pos
            bearing = initial_bearing_deg(pos, step.end.as_tuple())
            return [
                GuidanceEvent(
                    "progress",
                    f"Sigue recto {round_to(d_end)} metros hacia el {cardinal_es(bearing)}.",
                    3,
                )
            ]
        return events

    def _next_waypoint(self, seg_idx: int) -> LatLon:
        pts = self.route.polyline
        if seg_idx + 1 < len(pts):
            return pts[seg_idx + 1]
        return self.current_step.end.as_tuple()
