import json

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.deps import build_deps
from app.main import create_app
from app.vision.hazards import BBox, Detection, HazardClass
from tests.conftest import make_jpeg, make_settings


def new_session(client, lat=19.4326, lng=-99.1332):
    sid = client.post("/v1/sessions", json={"user_id": "u1"}).json()["session_id"]
    r = client.post(f"/v1/sessions/{sid}/location", json={"lat": lat, "lng": lng, "heading": 0})
    assert r.status_code == 200
    return sid


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["providers"]["rides"] == "fake"


def test_session_rest_flow(client):
    sid = new_session(client)
    r = client.post(f"/v1/sessions/{sid}/utterance", json={"text": "ayuda"})
    assert r.status_code == 200
    assert "Puedes decir" in r.json()["messages"][0]["text"]
    r = client.get(f"/v1/sessions/{sid}/state")
    assert r.json()["has_position"] is True
    r = client.put(
        f"/v1/sessions/{sid}/places",
        json={"alias": "home", "name": "Casa", "lat": 19.44, "lng": -99.14},
    )
    assert r.json()["count"] == 1
    assert client.get(f"/v1/sessions/{sid}/places").json()[0]["alias"] == "home"
    assert client.delete(f"/v1/sessions/{sid}").status_code == 204
    assert client.get(f"/v1/sessions/{sid}/state").status_code == 404


def test_frame_rest_endpoint(client, deps):
    sid = new_session(client)
    deps.detector.queue(
        [Detection(HazardClass.POTHOLE, 0.8, BBox(0.4, 0.7, 0.6, 0.95), distance_m=3.0)]
    )
    r = client.post(
        f"/v1/sessions/{sid}/frame", content=make_jpeg(), headers={"Content-Type": "image/jpeg"}
    )
    assert r.status_code == 200
    assert r.json()["alert"]["text"] == "Bache al frente, 3 metros"
    r = client.post(
        f"/v1/sessions/{sid}/frame", content=make_jpeg(), headers={"Content-Type": "image/jpeg"}
    )
    assert r.json()["alert"] is None


def test_websocket_frames_and_commands(client, deps):
    sid = new_session(client)
    deps.detector.queue(
        [Detection(HazardClass.STAIRS_DOWN, 0.9, BBox(0.4, 0.6, 0.6, 0.95), distance_m=2.0)]
    )
    with client.websocket_connect(f"/ws/{sid}") as ws:
        assert ws.receive_json()["type"] == "state"
        ws.send_bytes(make_jpeg())
        alert = ws.receive_json()
        assert alert["type"] == "alert"
        assert alert["text"] == "Escalera bajando al frente, 2 metros"
        assert alert["interrupt"] is True
        assert ws.receive_json() == {"type": "haptic", "pattern": "danger"}
        ws.send_text(
            json.dumps({"type": "location", "lat": 19.4327, "lng": -99.1332, "heading": 5})
        )
        ws.send_text(json.dumps({"type": "utterance", "text": "¿dónde estoy?"}))
        msg = ws.receive_json()
        assert msg["type"] == "speak" and msg["text"].startswith("Estás en Calle Falsa 123")
        ws.send_text("esto no es json")
        assert ws.receive_json()["type"] == "error"
        ws.send_text(json.dumps({"type": "ping"}))
        assert ws.receive_json() == {"type": "pong"}


def test_websocket_unknown_session(client):
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/ws/nope"):
            pass
    assert exc.value.code == 4404


def test_voice_endpoint(client, deps):
    sid = new_session(client)
    deps.transcriber.text = "¿dónde estoy?"
    r = client.post(
        f"/v1/sessions/{sid}/voice",
        files={"file": ("cmd.m4a", b"\x00\x01\x02", "audio/mp4")},
        data={"language": "es"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["transcript"] == "¿dónde estoy?"
    assert body["messages"][0]["text"].startswith("Estás en")
    deps.transcriber.text = ""
    r = client.post(f"/v1/sessions/{sid}/voice", files={"file": ("cmd.m4a", b"\x00", "audio/mp4")})
    assert r.json()["messages"][0]["text"] == "No te escuché bien. Inténtalo de nuevo."


def test_api_key_enforced():
    settings = make_settings(api_shared_secret="s3cret")
    app = create_app(build_deps(settings), settings)
    with TestClient(app) as c:
        assert c.post("/v1/sessions", json={}).status_code == 401
        r = c.post("/v1/sessions", json={}, headers={"X-API-Key": "s3cret"})
        assert r.status_code == 200
        sid = r.json()["session_id"]
        with c.websocket_connect(f"/ws/{sid}?key=s3cret") as ws:
            assert ws.receive_json()["type"] == "state"


def test_tts_unconfigured_returns_503(client):
    assert client.post("/v1/tts", json={"text": "hola"}).status_code == 503
