"""Cliente de Google Maps Platform: Routes API (WALK), Places Text Search (New) y Geocoding."""

from __future__ import annotations

import logging
import re
from typing import Protocol

import httpx
from pydantic import BaseModel, Field

from .geo import LatLon, decode_polyline, destination_point, haversine_m, initial_bearing_deg

log = logging.getLogger(__name__)


class MapsError(RuntimeError):
    pass


class LatLng(BaseModel):
    lat: float
    lng: float

    def as_tuple(self) -> LatLon:
        return (self.lat, self.lng)


class RouteStep(BaseModel):
    instruction: str = ""  # texto de Google en el idioma pedido
    maneuver: str = ""  # TURN_LEFT, TURN_RIGHT, DEPART, STRAIGHT...
    distance_m: float = 0.0
    duration_s: float = 0.0
    start: LatLng
    end: LatLng
    polyline: list[LatLon] = Field(default_factory=list)


class Route(BaseModel):
    steps: list[RouteStep]
    distance_m: float
    duration_s: float
    polyline: list[LatLon]
    destination: LatLng
    destination_name: str = ""


class Place(BaseModel):
    name: str
    address: str = ""
    location: LatLng


class MapsClient(Protocol):
    async def walking_route(
        self,
        origin: LatLng,
        destination: LatLng | str,
        *,
        language: str = "es",
        destination_name: str = "",
    ) -> Route: ...

    async def find_place(
        self, query: str, near: LatLng, *, language: str = "es", radius_m: float = 5000.0
    ) -> Place | None: ...

    async def reverse_geocode(self, location: LatLng, *, language: str = "es") -> str | None: ...


ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

ROUTES_FIELD_MASK = ",".join(
    [
        "routes.distanceMeters",
        "routes.duration",
        "routes.polyline.encodedPolyline",
        "routes.legs.steps.distanceMeters",
        "routes.legs.steps.staticDuration",
        "routes.legs.steps.navigationInstruction",
        "routes.legs.steps.polyline.encodedPolyline",
        "routes.legs.steps.startLocation",
        "routes.legs.steps.endLocation",
    ]
)
PLACES_FIELD_MASK = "places.displayName,places.formattedAddress,places.location"

_TAG_RE = re.compile(r"<[^>]+>")


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", _TAG_RE.sub(" ", text or "")).strip()


def _parse_duration(value: str | None) -> float:
    if not value:
        return 0.0
    return float(str(value).rstrip("s") or 0)


def _latlng(obj: dict) -> LatLng:
    ll = obj.get("latLng", obj)
    return LatLng(lat=float(ll["latitude"]), lng=float(ll["longitude"]))


def parse_routes_response(data: dict, destination_name: str = "") -> Route:
    routes = data.get("routes") or []
    if not routes:
        raise MapsError("Google no devolvió ninguna ruta peatonal")
    route = routes[0]
    legs = route.get("legs") or []
    steps: list[RouteStep] = []
    for leg in legs:
        for s in leg.get("steps", []):
            nav = s.get("navigationInstruction") or {}
            steps.append(
                RouteStep(
                    instruction=_clean_text(nav.get("instructions", "")),
                    maneuver=nav.get("maneuver", ""),
                    distance_m=float(s.get("distanceMeters", 0) or 0),
                    duration_s=_parse_duration(s.get("staticDuration")),
                    start=_latlng(s["startLocation"]),
                    end=_latlng(s["endLocation"]),
                    polyline=decode_polyline((s.get("polyline") or {}).get("encodedPolyline", "")),
                )
            )
    if not steps:
        raise MapsError("La ruta no contiene pasos")
    encoded = (route.get("polyline") or {}).get("encodedPolyline", "")
    polyline = decode_polyline(encoded) if encoded else [p for st in steps for p in st.polyline]
    if not polyline:
        polyline = [steps[0].start.as_tuple()] + [st.end.as_tuple() for st in steps]
    return Route(
        steps=steps,
        distance_m=float(route.get("distanceMeters") or sum(s.distance_m for s in steps)),
        duration_s=_parse_duration(route.get("duration")) or sum(s.duration_s for s in steps),
        polyline=polyline,
        destination=steps[-1].end,
        destination_name=destination_name,
    )


class GoogleMapsClient:
    def __init__(self, api_key: str, *, http: httpx.AsyncClient | None = None) -> None:
        self.api_key = api_key
        self.http = http or httpx.AsyncClient(timeout=10.0)

    @staticmethod
    def _location(value: LatLng | str) -> dict:
        if isinstance(value, str):
            return {"address": value}
        return {"location": {"latLng": {"latitude": value.lat, "longitude": value.lng}}}

    async def walking_route(
        self,
        origin: LatLng,
        destination: LatLng | str,
        *,
        language: str = "es",
        destination_name: str = "",
    ) -> Route:
        body = {
            "origin": self._location(origin),
            "destination": self._location(destination),
            "travelMode": "WALK",
            "languageCode": language,
            "units": "METRIC",
            "computeAlternativeRoutes": False,
        }
        headers = {
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": ROUTES_FIELD_MASK,
            "Content-Type": "application/json",
        }
        resp = await self.http.post(ROUTES_URL, json=body, headers=headers)
        if resp.status_code != 200:
            raise MapsError(f"Routes API {resp.status_code}: {resp.text[:200]}")
        return parse_routes_response(resp.json(), destination_name)

    async def find_place(
        self, query: str, near: LatLng, *, language: str = "es", radius_m: float = 5000.0
    ) -> Place | None:
        body = {
            "textQuery": query,
            "languageCode": language,
            "pageSize": 1,
            "locationBias": {
                "circle": {
                    "center": {"latitude": near.lat, "longitude": near.lng},
                    "radius": float(radius_m),
                }
            },
        }
        headers = {
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": PLACES_FIELD_MASK,
            "Content-Type": "application/json",
        }
        resp = await self.http.post(PLACES_URL, json=body, headers=headers)
        if resp.status_code != 200:
            raise MapsError(f"Places API {resp.status_code}: {resp.text[:200]}")
        places = resp.json().get("places") or []
        if not places:
            return None
        p = places[0]
        return Place(
            name=(p.get("displayName") or {}).get("text") or query,
            address=p.get("formattedAddress", ""),
            location=_latlng(p["location"]),
        )

    async def reverse_geocode(self, location: LatLng, *, language: str = "es") -> str | None:
        params = {
            "latlng": f"{location.lat},{location.lng}",
            "key": self.api_key,
            "language": language,
            "result_type": "street_address|route|intersection",
        }
        resp = await self.http.get(GEOCODE_URL, params=params)
        if resp.status_code != 200:
            raise MapsError(f"Geocoding API {resp.status_code}")
        results = resp.json().get("results") or []
        return results[0].get("formatted_address") if results else None


class FakeMapsClient:
    """Rutas en línea recta y lugares sintéticos. Para tests y desarrollo sin clave de Google."""

    def __init__(self) -> None:
        self.places: dict[str, Place] = {}
        self.address = "Calle Falsa 123, Centro"
        self.step_length_m = 150.0

    async def walking_route(
        self,
        origin: LatLng,
        destination: LatLng | str,
        *,
        language: str = "es",
        destination_name: str = "",
    ) -> Route:
        if isinstance(destination, str):
            place = await self.find_place(destination, origin)
            assert place is not None
            destination = place.location
        total = haversine_m(origin.as_tuple(), destination.as_tuple())
        bearing = initial_bearing_deg(origin.as_tuple(), destination.as_tuple())
        n = max(1, int(total // self.step_length_m))
        steps: list[RouteStep] = []
        cur = origin.as_tuple()
        for i in range(n):
            nxt = (
                destination.as_tuple()
                if i == n - 1
                else destination_point(origin.as_tuple(), bearing, total * (i + 1) / n)
            )
            dist = haversine_m(cur, nxt)
            steps.append(
                RouteStep(
                    instruction="" if i else "Dirígete hacia tu destino",
                    maneuver="DEPART" if i == 0 else "STRAIGHT",
                    distance_m=dist,
                    duration_s=dist / 1.3,
                    start=LatLng(lat=cur[0], lng=cur[1]),
                    end=LatLng(lat=nxt[0], lng=nxt[1]),
                    polyline=[cur, nxt],
                )
            )
            cur = nxt
        return Route(
            steps=steps,
            distance_m=total,
            duration_s=total / 1.3,
            polyline=[origin.as_tuple()] + [s.end.as_tuple() for s in steps],
            destination=destination,
            destination_name=destination_name,
        )

    async def find_place(
        self, query: str, near: LatLng, *, language: str = "es", radius_m: float = 5000.0
    ) -> Place | None:
        key = query.strip().lower()
        if key in self.places:
            return self.places[key]
        if key.startswith("nada"):
            return None
        lat, lng = destination_point(near.as_tuple(), 0.0, 300.0)
        return Place(
            name=query.strip().capitalize(),
            address="Dirección simulada",
            location=LatLng(lat=lat, lng=lng),
        )

    async def reverse_geocode(self, location: LatLng, *, language: str = "es") -> str | None:
        return self.address
