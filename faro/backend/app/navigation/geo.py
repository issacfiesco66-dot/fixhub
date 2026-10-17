"""Utilidades geográficas: distancias, rumbos, brújula, reloj y polilíneas."""

from __future__ import annotations

import math

EARTH_RADIUS_M = 6_371_008.8

LatLon = tuple[float, float]

CARDINALS_ES = ("norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste")


def haversine_m(a: LatLon, b: LatLon) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def initial_bearing_deg(a: LatLon, b: LatLon) -> float:
    """Rumbo inicial de a hacia b, en grados 0..360 (0 = norte, 90 = este)."""
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360.0) % 360.0


def destination_point(origin: LatLon, bearing_deg: float, distance_m: float) -> LatLon:
    """Punto a `distance_m` metros de `origin` siguiendo `bearing_deg`."""
    lat1, lon1 = map(math.radians, origin)
    brg = math.radians(bearing_deg)
    ad = distance_m / EARTH_RADIUS_M
    lat2 = math.asin(math.sin(lat1) * math.cos(ad) + math.cos(lat1) * math.sin(ad) * math.cos(brg))
    lon2 = lon1 + math.atan2(
        math.sin(brg) * math.sin(ad) * math.cos(lat1),
        math.cos(ad) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), ((math.degrees(lon2) + 540.0) % 360.0) - 180.0


def cardinal_es(bearing_deg: float) -> str:
    idx = int(((bearing_deg % 360.0) + 22.5) // 45.0) % 8
    return CARDINALS_ES[idx]


def relative_angle(heading_deg: float, bearing_deg: float) -> float:
    """Ángulo que hay que girar desde `heading` hasta `bearing`: -180..180 (+ = derecha)."""
    return ((bearing_deg - heading_deg + 540.0) % 360.0) - 180.0


def turn_phrase_es(delta_deg: float) -> str:
    a = abs(delta_deg)
    side = "derecha" if delta_deg > 0 else "izquierda"
    if a <= 15:
        return "sigue recto"
    if a <= 45:
        return f"gira ligeramente a la {side}"
    if a <= 135:
        return f"gira a la {side}"
    return "da media vuelta"


def clock_position_es(delta_deg: float) -> str:
    """Posición tipo reloj usada en orientación y movilidad: 'a las 2 en punto'."""
    hour = round(delta_deg / 30.0) % 12
    hour = 12 if hour == 0 else hour
    return f"a las {hour} en punto"


def decode_polyline(encoded: str, precision: int = 5) -> list[LatLon]:
    """Decodifica una polilínea codificada de Google."""
    factor = 10**precision
    coords: list[LatLon] = []
    index = lat = lon = 0
    while index < len(encoded):
        for is_lon in (False, True):
            shift = result = 0
            while True:
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if is_lon:
                lon += delta
            else:
                lat += delta
        coords.append((lat / factor, lon / factor))
    return coords


def _to_xy(p: LatLon, ref_lat_rad: float) -> tuple[float, float]:
    # Proyección equirectangular local (suficiente a escala peatonal).
    x = math.radians(p[1]) * math.cos(ref_lat_rad) * EARTH_RADIUS_M
    y = math.radians(p[0]) * EARTH_RADIUS_M
    return x, y


def point_to_segment_m(p: LatLon, a: LatLon, b: LatLon) -> tuple[float, float]:
    """Distancia (m) de p al segmento ab y fracción 0..1 del punto más cercano sobre ab."""
    ref = math.radians(p[0])
    px, py = _to_xy(p, ref)
    ax, ay = _to_xy(a, ref)
    bx, by = _to_xy(b, ref)
    dx, dy = bx - ax, by - ay
    seg_len2 = dx * dx + dy * dy
    if seg_len2 == 0:
        return math.hypot(px - ax, py - ay), 0.0
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg_len2))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy), t


def distance_to_polyline_m(p: LatLon, points: list[LatLon]) -> tuple[float, int, float]:
    """Distancia mínima (m) de p a la polilínea, índice del segmento y fracción dentro de él."""
    if not points:
        return float("inf"), 0, 0.0
    if len(points) == 1:
        return haversine_m(p, points[0]), 0, 0.0
    best = (float("inf"), 0, 0.0)
    for i in range(len(points) - 1):
        d, t = point_to_segment_m(p, points[i], points[i + 1])
        if d < best[0]:
            best = (d, i, t)
    return best


def round_to(value: float, step: int = 5) -> int:
    return int(max(step, round(value / step) * step))
