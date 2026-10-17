"""Integración con Uber.

Dos proveedores:
  * UberDeepLinkProvider: abre la app de Uber con origen/destino precargados (Universal Link).
    No requiere permisos especiales; el usuario confirma dentro de Uber (accesible con VoiceOver
    y TalkBack). Es la opción recomendada para lanzar.
  * UberApiClient: Ride Requests API v1.2 (cotizar, solicitar, estado, cancelar). El scope
    `request` es privilegiado: Uber debe aprobar la app antes de poder solicitar viajes reales.
"""

from __future__ import annotations

import logging
from typing import Protocol
from urllib.parse import urlencode

import httpx
from pydantic import BaseModel

from ..navigation.google_maps import LatLng

log = logging.getLogger(__name__)


class RideError(RuntimeError):
    pass


class RideQuote(BaseModel):
    provider: str
    product_id: str | None = None
    product_name: str = "Uber"
    price_low: float | None = None
    price_high: float | None = None
    currency: str | None = None
    eta_pickup_s: int | None = None
    duration_s: int | None = None
    distance_km: float | None = None
    fare_id: str | None = None
    deep_link: str | None = None
    origin: LatLng
    destination: LatLng
    destination_name: str


class RideRequestResult(BaseModel):
    provider: str
    request_id: str | None = None
    status: str = (
        "processing"  # processing | accepted | arriving | in_progress | completed | handoff
    )
    eta_s: int | None = None
    driver_name: str | None = None
    vehicle_make: str | None = None
    vehicle_model: str | None = None
    vehicle_plate: str | None = None
    deep_link: str | None = None


class RideProvider(Protocol):
    name: str

    async def quote(
        self,
        origin: LatLng,
        destination: LatLng,
        destination_name: str,
        *,
        user_token: str | None = None,
        destination_address: str | None = None,
    ) -> RideQuote: ...

    async def request(
        self, quote: RideQuote, *, user_token: str | None = None
    ) -> RideRequestResult: ...

    async def status(self, *, user_token: str | None = None) -> RideRequestResult | None: ...

    async def cancel(self, *, user_token: str | None = None) -> bool: ...


def build_uber_deep_link(
    *,
    client_id: str,
    dropoff: LatLng,
    dropoff_name: str,
    pickup: LatLng | None = None,
    dropoff_address: str | None = None,
    product_id: str | None = None,
) -> str:
    params: dict[str, str] = {"action": "setPickup"}
    if client_id:
        params["client_id"] = client_id
    if pickup is None:
        params["pickup"] = "my_location"
    else:
        params["pickup[latitude]"] = f"{pickup.lat:.6f}"
        params["pickup[longitude]"] = f"{pickup.lng:.6f}"
    params["dropoff[latitude]"] = f"{dropoff.lat:.6f}"
    params["dropoff[longitude]"] = f"{dropoff.lng:.6f}"
    params["dropoff[nickname]"] = dropoff_name
    if dropoff_address:
        params["dropoff[formatted_address]"] = dropoff_address
    if product_id:
        params["product_id"] = product_id
    return "https://m.uber.com/ul/?" + urlencode(params)


class UberDeepLinkProvider:
    name = "uber_deeplink"

    def __init__(self, client_id: str = "") -> None:
        self.client_id = client_id

    async def quote(
        self,
        origin: LatLng,
        destination: LatLng,
        destination_name: str,
        *,
        user_token: str | None = None,
        destination_address: str | None = None,
    ) -> RideQuote:
        link = build_uber_deep_link(
            client_id=self.client_id,
            pickup=origin,
            dropoff=destination,
            dropoff_name=destination_name,
            dropoff_address=destination_address,
        )
        return RideQuote(
            provider=self.name,
            deep_link=link,
            origin=origin,
            destination=destination,
            destination_name=destination_name,
        )

    async def request(
        self, quote: RideQuote, *, user_token: str | None = None
    ) -> RideRequestResult:
        return RideRequestResult(provider=self.name, status="handoff", deep_link=quote.deep_link)

    async def status(self, *, user_token: str | None = None) -> RideRequestResult | None:
        return None

    async def cancel(self, *, user_token: str | None = None) -> bool:
        return False


class UberApiClient:
    name = "uber_api"
    AUTH_BASE = "https://auth.uber.com/oauth/v2"

    def __init__(
        self,
        *,
        client_id: str,
        client_secret: str,
        server_token: str = "",
        redirect_uri: str,
        sandbox: bool = True,
        http: httpx.AsyncClient | None = None,
    ) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.server_token = server_token
        self.redirect_uri = redirect_uri
        self.base_url = (
            "https://sandbox-api.uber.com/v1.2" if sandbox else "https://api.uber.com/v1.2"
        )
        self.http = http or httpx.AsyncClient(timeout=12.0)

    # ---- OAuth 2.0 (Authorization Code) ----
    def authorize_url(self, state: str, scopes: str = "profile request") -> str:
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": scopes,
            "state": state,
        }
        return f"{self.AUTH_BASE}/authorize?{urlencode(params)}"

    async def exchange_code(self, code: str) -> dict:
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "authorization_code",
            "redirect_uri": self.redirect_uri,
            "code": code,
        }
        resp = await self.http.post(f"{self.AUTH_BASE}/token", data=data)
        if resp.status_code != 200:
            raise RideError(f"Uber OAuth {resp.status_code}: {resp.text[:200]}")
        return resp.json()

    # ---- helpers HTTP ----
    def _headers(self, user_token: str | None) -> dict[str, str]:
        if user_token:
            return {"Authorization": f"Bearer {user_token}", "Accept-Language": "es_MX"}
        if self.server_token:
            return {"Authorization": f"Token {self.server_token}", "Accept-Language": "es_MX"}
        raise RideError("Falta token de Uber (usuario o servidor)")

    async def _call(self, method: str, path: str, *, user_token: str | None = None, **kw) -> dict:
        resp = await self.http.request(
            method, f"{self.base_url}{path}", headers=self._headers(user_token), **kw
        )
        if resp.status_code >= 400:
            detail = resp.text[:200]
            log.warning("Uber %s %s -> %s %s", method, path, resp.status_code, detail)
            if resp.status_code == 401:
                raise RideError("Tu sesión de Uber expiró. Vincula Uber de nuevo.")
            if resp.status_code == 409:
                raise RideError("Uber pide confirmar la tarifa en su app.")
            raise RideError(f"Uber respondió {resp.status_code}")
        if resp.status_code == 204 or not resp.content:
            return {}
        return resp.json()

    # ---- Ride Requests API ----
    async def _pick_product(self, origin: LatLng, user_token: str | None) -> tuple[str | None, str]:
        data = await self._call(
            "GET",
            "/products",
            user_token=user_token,
            params={"latitude": origin.lat, "longitude": origin.lng},
        )
        products = data.get("products") or []
        if not products:
            return None, "Uber"
        for p in products:
            if "uberx" in str(p.get("display_name", "")).lower():
                return p.get("product_id"), p.get("display_name", "UberX")
        return products[0].get("product_id"), products[0].get("display_name", "Uber")

    async def quote(
        self,
        origin: LatLng,
        destination: LatLng,
        destination_name: str,
        *,
        user_token: str | None = None,
        destination_address: str | None = None,
    ) -> RideQuote:
        product_id, product_name = await self._pick_product(origin, user_token)
        quote = RideQuote(
            provider=self.name,
            product_id=product_id,
            product_name=product_name,
            origin=origin,
            destination=destination,
            destination_name=destination_name,
        )
        if user_token and product_id:
            data = await self._call(
                "POST",
                "/requests/estimate",
                user_token=user_token,
                json={
                    "product_id": product_id,
                    "start_latitude": origin.lat,
                    "start_longitude": origin.lng,
                    "end_latitude": destination.lat,
                    "end_longitude": destination.lng,
                },
            )
            fare = data.get("fare") or {}
            estimate = data.get("estimate") or {}
            trip = data.get("trip") or {}
            quote.price_low = fare.get("value", estimate.get("low_estimate"))
            quote.price_high = fare.get("value", estimate.get("high_estimate"))
            quote.currency = fare.get("currency_code") or estimate.get("currency_code")
            quote.fare_id = fare.get("fare_id")
            pickup_min = data.get("pickup_estimate")
            quote.eta_pickup_s = int(pickup_min) * 60 if pickup_min is not None else None
            quote.duration_s = trip.get("duration_estimate")
            quote.distance_km = trip.get("distance_estimate")
            return quote

        prices = (
            await self._call(
                "GET",
                "/estimates/price",
                params={
                    "start_latitude": origin.lat,
                    "start_longitude": origin.lng,
                    "end_latitude": destination.lat,
                    "end_longitude": destination.lng,
                },
            )
        ).get("prices") or []
        chosen = next((p for p in prices if p.get("product_id") == product_id), None) or (
            prices[0] if prices else None
        )
        if chosen:
            quote.price_low = chosen.get("low_estimate")
            quote.price_high = chosen.get("high_estimate")
            quote.currency = chosen.get("currency_code")
            quote.duration_s = chosen.get("duration")
            miles = chosen.get("distance")
            quote.distance_km = round(float(miles) * 1.609, 1) if miles is not None else None
        times = (
            await self._call(
                "GET",
                "/estimates/time",
                params={"start_latitude": origin.lat, "start_longitude": origin.lng},
            )
        ).get("times") or []
        chosen_t = next((t for t in times if t.get("product_id") == product_id), None) or (
            times[0] if times else None
        )
        if chosen_t and chosen_t.get("estimate") is not None:
            quote.eta_pickup_s = int(chosen_t["estimate"])
        return quote

    async def request(
        self, quote: RideQuote, *, user_token: str | None = None
    ) -> RideRequestResult:
        if not user_token:
            raise RideError("Para pedir el Uber automáticamente primero vincula tu cuenta de Uber.")
        body: dict = {
            "start_latitude": quote.origin.lat,
            "start_longitude": quote.origin.lng,
            "end_latitude": quote.destination.lat,
            "end_longitude": quote.destination.lng,
            "end_nickname": quote.destination_name,
        }
        if quote.product_id:
            body["product_id"] = quote.product_id
        if quote.fare_id:
            body["fare_id"] = quote.fare_id
        data = await self._call("POST", "/requests", user_token=user_token, json=body)
        return self._parse_request(data)

    async def status(self, *, user_token: str | None = None) -> RideRequestResult | None:
        try:
            data = await self._call("GET", "/requests/current", user_token=user_token)
        except RideError:
            return None
        return self._parse_request(data) if data else None

    async def cancel(self, *, user_token: str | None = None) -> bool:
        await self._call("DELETE", "/requests/current", user_token=user_token)
        return True

    def _parse_request(self, data: dict) -> RideRequestResult:
        driver = data.get("driver") or {}
        vehicle = data.get("vehicle") or {}
        eta_min = data.get("eta")
        return RideRequestResult(
            provider=self.name,
            request_id=data.get("request_id"),
            status=data.get("status", "processing"),
            eta_s=int(eta_min) * 60 if eta_min is not None else None,
            driver_name=driver.get("name"),
            vehicle_make=vehicle.get("make"),
            vehicle_model=vehicle.get("model"),
            vehicle_plate=vehicle.get("license_plate"),
        )


class FakeRideProvider:
    """Proveedor determinista para tests y demos sin credenciales de Uber."""

    name = "fake"

    def __init__(self) -> None:
        self.requests: list[RideQuote] = []
        self.cancelled = 0

    async def quote(
        self,
        origin: LatLng,
        destination: LatLng,
        destination_name: str,
        *,
        user_token: str | None = None,
        destination_address: str | None = None,
    ) -> RideQuote:
        return RideQuote(
            provider=self.name,
            product_id="fake-uberx",
            product_name="UberX",
            price_low=85,
            price_high=100,
            currency="MXN",
            eta_pickup_s=240,
            duration_s=600,
            distance_km=4.2,
            fare_id="fake-fare",
            origin=origin,
            destination=destination,
            destination_name=destination_name,
        )

    async def request(
        self, quote: RideQuote, *, user_token: str | None = None
    ) -> RideRequestResult:
        self.requests.append(quote)
        return RideRequestResult(
            provider=self.name,
            request_id=f"fake-req-{len(self.requests)}",
            status="accepted",
            eta_s=240,
            driver_name="Juan",
            vehicle_make="Toyota",
            vehicle_model="Corolla",
            vehicle_plate="ABC-123",
        )

    async def status(self, *, user_token: str | None = None) -> RideRequestResult | None:
        return None

    async def cancel(self, *, user_token: str | None = None) -> bool:
        self.cancelled += 1
        return True
