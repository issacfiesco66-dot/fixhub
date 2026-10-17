from urllib.parse import parse_qs, urlparse

import httpx

from app.navigation.google_maps import FakeMapsClient, LatLng
from app.rides.flow import RideFlow, minutes_phrase_es, money_phrase_es
from app.rides.uber import (
    FakeRideProvider,
    UberApiClient,
    UberDeepLinkProvider,
    build_uber_deep_link,
)
from app.session.manager import Position, SavedPlace, Session


def make_session() -> Session:
    s = Session(id="s1", user_id="u1")
    s.position = Position(lat=19.4326, lon=-99.1332, heading=0.0)
    return s


def test_phrases():
    assert money_phrase_es(85, 100, "MXN") == "entre 85 y 100 pesos"
    assert money_phrase_es(85.4, 85.4, "USD") == "85 dólares"
    assert money_phrase_es(None, None, "MXN") is None
    assert minutes_phrase_es(240) == "4 minutos"
    assert minutes_phrase_es(61) == "1 minuto"
    assert minutes_phrase_es(20) == "menos de un minuto"


async def test_quote_confirm_and_request():
    provider = FakeRideProvider()
    flow = RideFlow(provider, FakeMapsClient())
    session = make_session()
    prompt = await flow.start(session, "aeropuerto", None)
    assert prompt == (
        "Uber UberX a Aeropuerto: cuesta entre 85 y 100 pesos y el conductor llegaría "
        "en 4 minutos. ¿Confirmas?"
    )
    assert session.pending is not None and session.pending.kind == "ride"
    text, extra = await flow.confirm(session)
    assert text == (
        "Listo. Uber solicitado a Aeropuerto. Juan llega en 4 minutos en un Toyota Corolla, "
        "placas ABC-123."
    )
    assert extra[0]["type"] == "ride_status"
    assert len(provider.requests) == 1
    assert session.pending is None and session.active_ride is not None
    assert await flow.cancel(session) == "Viaje cancelado."
    assert provider.cancelled == 1 and session.active_ride is None


async def test_confirm_without_pending_or_expired():
    provider = FakeRideProvider()
    flow = RideFlow(provider, FakeMapsClient())
    session = make_session()
    text, _ = await flow.confirm(session)
    assert text == "No hay ningún viaje pendiente por confirmar."
    await flow.start(session, "aeropuerto", None)
    session.pending.expires_at = -1
    text, _ = await flow.confirm(session)
    assert text == "La cotización expiró. Pide el Uber de nuevo."
    assert provider.requests == []


async def test_home_alias_requires_saved_place():
    flow = RideFlow(FakeRideProvider(), FakeMapsClient())
    session = make_session()
    assert await flow.start(session, "casa", "home") == (
        "No tienes guardado casa. Di: guarda este lugar como casa."
    )
    session.saved_places["home"] = SavedPlace("home", "casa", 19.44, -99.14)
    prompt = await flow.start(session, "casa", "home")
    assert prompt.startswith("Uber UberX a casa: cuesta entre 85 y 100 pesos")


async def test_no_position_or_destination():
    flow = RideFlow(FakeRideProvider(), FakeMapsClient())
    session = Session(id="s", user_id="u")
    assert (await flow.start(session, "x", None)).startswith("Aún no tengo tu ubicación")
    session = make_session()
    assert await flow.start(session, None, None) == "¿A dónde quieres ir en Uber?"
    assert session.pending.kind == "ride_destination"


async def test_deeplink_provider_hands_off_to_uber_app():
    flow = RideFlow(UberDeepLinkProvider(client_id="abc123"), FakeMapsClient())
    session = make_session()
    session.saved_places["home"] = SavedPlace("home", "Casa", 19.44, -99.14, "Calle 1")
    assert (
        await flow.start(session, "casa", "home")
        == "Puedo abrir Uber con destino Casa. ¿Confirmas?"
    )
    text, extra = await flow.confirm(session)
    assert text.startswith("Abriendo Uber con destino Casa.")
    assert extra[0]["type"] == "open_url"
    url = urlparse(extra[0]["url"])
    qs = parse_qs(url.query)
    assert url.netloc == "m.uber.com" and url.path == "/ul/"
    assert qs["action"] == ["setPickup"] and qs["client_id"] == ["abc123"]
    assert qs["dropoff[nickname]"] == ["Casa"] and qs["dropoff[latitude]"] == ["19.440000"]
    assert qs["pickup[latitude]"] == ["19.432600"]


def test_build_deep_link_my_location():
    url = build_uber_deep_link(
        client_id="", dropoff=LatLng(lat=1.0, lng=2.0), dropoff_name="Trabajo"
    )
    qs = parse_qs(urlparse(url).query)
    assert qs["pickup"] == ["my_location"] and "client_id" not in qs


async def test_uber_api_client_quote_and_request():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path, request.headers.get("authorization")))
        if request.url.path.endswith("/products"):
            return httpx.Response(
                200,
                json={
                    "products": [
                        {"product_id": "p-black", "display_name": "Uber Black"},
                        {"product_id": "p-x", "display_name": "UberX"},
                    ]
                },
            )
        if request.url.path.endswith("/requests/estimate"):
            return httpx.Response(
                200,
                json={
                    "fare": {"value": 92.5, "fare_id": "fare-1", "currency_code": "MXN"},
                    "trip": {"duration_estimate": 540, "distance_estimate": 3.9},
                    "pickup_estimate": 3,
                },
            )
        if request.url.path.endswith("/requests"):
            return httpx.Response(202, json={"request_id": "r-1", "status": "processing", "eta": 5})
        if request.url.path.endswith("/requests/current"):
            return httpx.Response(204)
        return httpx.Response(404)

    client = UberApiClient(
        client_id="c",
        client_secret="s",
        redirect_uri="faro://cb",
        http=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    origin, dest = LatLng(lat=19.43, lng=-99.13), LatLng(lat=19.44, lng=-99.14)
    quote = await client.quote(origin, dest, "Casa", user_token="tok")
    assert quote.product_id == "p-x" and quote.product_name == "UberX"
    assert quote.price_low == 92.5 and quote.fare_id == "fare-1" and quote.eta_pickup_s == 180
    result = await client.request(quote, user_token="tok")
    assert result.request_id == "r-1" and result.eta_s == 300
    assert await client.cancel(user_token="tok") is True
    assert calls[0][2] == "Bearer tok"
    assert client.authorize_url("state1").startswith("https://auth.uber.com/oauth/v2/authorize?")
