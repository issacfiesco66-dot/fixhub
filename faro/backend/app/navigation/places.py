"""Resolución de destinos: lugares guardados (casa/trabajo) o búsqueda en Google Places."""

from __future__ import annotations

from ..session.manager import Session
from .google_maps import LatLng, MapsClient, Place

ALIAS_LABEL_ES = {"home": "casa", "work": "el trabajo"}


async def resolve_destination(
    maps: MapsClient,
    session: Session,
    text: str | None,
    alias: str | None,
    *,
    radius_m: float = 5000.0,
) -> Place | None:
    if alias and alias in session.saved_places:
        sp = session.saved_places[alias]
        return Place(
            name=sp.name, address=sp.address or "", location=LatLng(lat=sp.lat, lng=sp.lon)
        )
    if alias and alias in ALIAS_LABEL_ES:
        return None  # alias conocido pero no guardado: el asistente pide guardarlo
    if not text or session.position is None:
        return None
    near = LatLng(lat=session.position.lat, lng=session.position.lon)
    return await maps.find_place(text, near, language=session.language, radius_m=radius_m)
