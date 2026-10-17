import httpx
import pytest

from app.navigation.geo import destination_point
from app.navigation.google_maps import (
    GoogleMapsClient,
    LatLng,
    MapsError,
    parse_routes_response,
)

A = (19.4326, -99.1332)
B = destination_point(A, 0, 100)
C = destination_point(B, 90, 60)


def encode_polyline(points, precision=5):
    def enc(v):
        v = v << 1 if v >= 0 else ~(v << 1)
        out = ""
        while v >= 0x20:
            out += chr((0x20 | (v & 0x1F)) + 63)
            v >>= 5
        return out + chr(v + 63)

    factor = 10**precision
    out, prev_lat, prev_lng = "", 0, 0
    for lat, lng in points:
        ilat, ilng = round(lat * factor), round(lng * factor)
        out += enc(ilat - prev_lat) + enc(ilng - prev_lng)
        prev_lat, prev_lng = ilat, ilng
    return out


def latlng(p):
    return {"latLng": {"latitude": p[0], "longitude": p[1]}}


ROUTES_JSON = {
    "routes": [
        {
            "distanceMeters": 160,
            "duration": "128s",
            "polyline": {"encodedPolyline": encode_polyline([A, B, C])},
            "legs": [
                {
                    "steps": [
                        {
                            "distanceMeters": 100,
                            "staticDuration": "80s",
                            "polyline": {"encodedPolyline": encode_polyline([A, B])},
                            "startLocation": latlng(A),
                            "endLocation": latlng(B),
                            "navigationInstruction": {
                                "maneuver": "DEPART",
                                "instructions": "Dirígete al <b>norte</b> por Calle 1",
                            },
                        },
                        {
                            "distanceMeters": 60,
                            "staticDuration": "48s",
                            "polyline": {"encodedPolyline": encode_polyline([B, C])},
                            "startLocation": latlng(B),
                            "endLocation": latlng(C),
                            "navigationInstruction": {
                                "maneuver": "TURN_RIGHT",
                                "instructions": "Gira a la derecha hacia Calle Madero",
                            },
                        },
                    ]
                }
            ],
        }
    ]
}


def test_parse_routes_response():
    route = parse_routes_response(ROUTES_JSON, "Farmacia")
    assert route.distance_m == 160 and route.duration_s == 128
    assert len(route.steps) == 2
    assert route.steps[0].instruction == "Dirígete al norte por Calle 1"
    assert route.steps[1].maneuver == "TURN_RIGHT"
    assert len(route.polyline) == 3
    assert route.destination.lat == pytest.approx(C[0], abs=1e-5)
    assert route.destination_name == "Farmacia"


def test_parse_routes_response_without_routes():
    with pytest.raises(MapsError):
        parse_routes_response({"routes": []})


async def test_client_sends_walk_request_with_field_mask():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        captured["body"] = request.read()
        return httpx.Response(200, json=ROUTES_JSON)

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = GoogleMapsClient("test-key", http=http)
    route = await client.walking_route(LatLng(lat=A[0], lng=A[1]), "Farmacia Centro")
    assert route.steps
    assert captured["url"].startswith("https://routes.googleapis.com/directions/v2:computeRoutes")
    assert captured["headers"]["x-goog-api-key"] == "test-key"
    assert "routes.legs.steps.navigationInstruction" in captured["headers"]["x-goog-fieldmask"]
    assert b'"travelMode": "WALK"' in captured["body"] or b'"travelMode":"WALK"' in captured["body"]
    assert b"Farmacia Centro" in captured["body"]


async def test_find_place_and_reverse_geocode():
    def handler(request: httpx.Request) -> httpx.Response:
        if "places:searchText" in str(request.url):
            return httpx.Response(
                200,
                json={
                    "places": [
                        {
                            "displayName": {"text": "Farmacia Guadalajara", "languageCode": "es"},
                            "formattedAddress": "Av. Juárez 10, Centro",
                            "location": {"latitude": 19.43, "longitude": -99.14},
                        }
                    ]
                },
            )
        return httpx.Response(
            200, json={"status": "OK", "results": [{"formatted_address": "Calle Madero 1, Centro"}]}
        )

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = GoogleMapsClient("k", http=http)
    place = await client.find_place("farmacia", LatLng(lat=A[0], lng=A[1]))
    assert place is not None and place.name == "Farmacia Guadalajara"
    assert place.location.lng == -99.14
    assert await client.reverse_geocode(LatLng(lat=A[0], lng=A[1])) == "Calle Madero 1, Centro"


async def test_http_error_raises_maps_error():
    http = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda r: httpx.Response(403, text="denied"))
    )
    client = GoogleMapsClient("k", http=http)
    with pytest.raises(MapsError):
        await client.walking_route(LatLng(lat=A[0], lng=A[1]), LatLng(lat=B[0], lng=B[1]))
