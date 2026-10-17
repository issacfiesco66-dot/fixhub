"""Flujo conversacional de Uber: cotizar -> confirmar por voz -> solicitar."""

from __future__ import annotations

import logging
import time

from ..navigation.google_maps import LatLng, MapsClient
from ..navigation.places import ALIAS_LABEL_ES, resolve_destination
from ..session.manager import PendingAction, Session
from .uber import RideError, RideProvider, RideQuote

log = logging.getLogger(__name__)

CURRENCY_ES = {
    "MXN": "pesos",
    "USD": "dólares",
    "EUR": "euros",
    "COP": "pesos",
    "ARS": "pesos",
    "CLP": "pesos",
    "PEN": "soles",
    "BRL": "reales",
    "GBP": "libras",
    "UYU": "pesos",
}


def money_phrase_es(low: float | None, high: float | None, currency: str | None) -> str | None:
    if low is None and high is None:
        return None
    unit = CURRENCY_ES.get((currency or "").upper(), currency or "")
    lo = round(low if low is not None else high)  # type: ignore[arg-type]
    hi = round(high if high is not None else low)  # type: ignore[arg-type]
    text = f"{lo} {unit}" if lo == hi else f"entre {lo} y {hi} {unit}"
    return text.strip()


def minutes_phrase_es(seconds: float | None) -> str | None:
    if seconds is None:
        return None
    if seconds < 60:
        return "menos de un minuto"
    m = max(1, round(seconds / 60))
    return "1 minuto" if m == 1 else f"{m} minutos"


def quote_prompt_es(quote: RideQuote) -> str:
    dest = quote.destination_name
    if quote.deep_link and quote.price_low is None:
        return f"Puedo abrir Uber con destino {dest}. ¿Confirmas?"
    parts = [f"Uber {quote.product_name} a {dest}"]
    money = money_phrase_es(quote.price_low, quote.price_high, quote.currency)
    if money:
        parts.append(f"cuesta {money}")
    eta = minutes_phrase_es(quote.eta_pickup_s)
    if eta:
        parts.append(f"el conductor llegaría en {eta}")
    if len(parts) == 1:
        return f"Uber a {dest}. ¿Confirmas?"
    return f"{parts[0]}: {' y '.join(parts[1:])}. ¿Confirmas?"


class RideFlow:
    def __init__(
        self,
        provider: RideProvider,
        maps: MapsClient,
        *,
        confirm_timeout_s: float = 45.0,
        search_radius_m: float = 5000.0,
        clock=time.monotonic,
    ) -> None:
        self.provider = provider
        self.maps = maps
        self.confirm_timeout_s = confirm_timeout_s
        self.search_radius_m = search_radius_m
        self._clock = clock

    async def start(self, session: Session, destination_text: str | None, alias: str | None) -> str:
        if session.position is None:
            return "Aún no tengo tu ubicación. Espera unos segundos e inténtalo de nuevo."
        if not destination_text and not alias:
            session.pending = PendingAction(
                kind="ride_destination",
                payload=None,
                expires_at=self._clock() + self.confirm_timeout_s,
            )
            return "¿A dónde quieres ir en Uber?"
        place = await resolve_destination(
            self.maps, session, destination_text, alias, radius_m=self.search_radius_m
        )
        if place is None:
            if alias in ALIAS_LABEL_ES:
                label = ALIAS_LABEL_ES[alias]
                return f"No tienes guardado {label}. Di: guarda este lugar como {label}."
            return f"No encontré {destination_text}. Intenta con otro nombre o dirección."
        origin = LatLng(lat=session.position.lat, lng=session.position.lon)
        try:
            quote = await self.provider.quote(
                origin,
                place.location,
                place.name,
                user_token=session.uber_token,
                destination_address=place.address or None,
            )
        except RideError as exc:
            return f"No pude cotizar el viaje. {exc}"
        prompt = quote_prompt_es(quote)
        session.pending = PendingAction(
            kind="ride",
            payload=quote,
            expires_at=self._clock() + self.confirm_timeout_s,
            prompt=prompt,
        )
        return prompt

    async def confirm(self, session: Session) -> tuple[str, list[dict]]:
        pending = session.pending
        if pending is None or pending.kind != "ride":
            return "No hay ningún viaje pendiente por confirmar.", []
        session.pending = None
        if pending.expires_at < self._clock():
            return "La cotización expiró. Pide el Uber de nuevo.", []
        quote: RideQuote = pending.payload
        try:
            result = await self.provider.request(quote, user_token=session.uber_token)
        except RideError as exc:
            return f"No pude solicitar el Uber. {exc}", []
        session.active_ride = result
        if result.status == "handoff" and result.deep_link:
            return (
                f"Abriendo Uber con destino {quote.destination_name}. "
                "Revisa y confirma el viaje en la app de Uber.",
                [{"type": "open_url", "url": result.deep_link}],
            )
        text = f"Listo. Uber solicitado a {quote.destination_name}."
        if result.driver_name:
            eta = minutes_phrase_es(result.eta_s)
            car = " ".join(p for p in (result.vehicle_make, result.vehicle_model) if p)
            text += f" {result.driver_name} llega" + (f" en {eta}" if eta else "")
            if car:
                text += f" en un {car}"
            if result.vehicle_plate:
                text += f", placas {result.vehicle_plate}"
            text += "."
        else:
            text += " Buscando conductor; te aviso cuando acepte."
        return text, [{"type": "ride_status", **result.model_dump()}]

    async def cancel(self, session: Session) -> str:
        if session.active_ride is None:
            return "No hay ningún viaje activo."
        session.active_ride = None
        try:
            ok = await self.provider.cancel(user_token=session.uber_token)
        except RideError as exc:
            return f"No pude cancelar el viaje. {exc}"
        return "Viaje cancelado." if ok else "Cancela el viaje desde la app de Uber."
