"""API HTTP + WebSocket del backend de Faro.

Flujo principal (app móvil):
  POST /v1/sessions                -> session_id
  WS   /ws/{session_id}            -> binario = fotograma JPEG; texto = JSON (location|utterance)
                                      respuestas: alert | speak | nav | haptic | open_url | state
  POST /v1/sessions/{id}/voice     -> audio del comando (multipart) -> transcripción + respuestas
"""

from __future__ import annotations

import json
import logging

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket
from fastapi.responses import HTMLResponse, Response
from starlette.websockets import WebSocketDisconnect

from . import __version__
from .config import Settings, get_settings
from .deps import Deps, build_deps
from .rides.uber import RideError, UberApiClient
from .schemas import (
    CreateSessionRequest,
    CreateSessionResponse,
    FrameResponse,
    LocationUpdate,
    MessagesResponse,
    SavedPlaceIn,
    TtsRequest,
    UberCodeRequest,
    UtteranceRequest,
    VoiceResponse,
)
from .session.manager import SavedPlace, Session

log = logging.getLogger("faro")


def create_app(deps: Deps | None = None, settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level.upper())
    deps = deps or build_deps(settings)

    app = FastAPI(title="Faro backend", version=__version__)
    app.state.deps = deps

    def get_deps(request: Request) -> Deps:
        return request.app.state.deps

    def require_api_key(request: Request, d: Deps = Depends(get_deps)) -> None:
        secret = d.settings.api_shared_secret
        if secret and request.headers.get("x-api-key") != secret:
            raise HTTPException(status_code=401, detail="API key inválida")

    def get_session(session_id: str, d: Deps = Depends(get_deps)) -> Session:
        session = d.sessions.get(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        return session

    # ------------------------------------------------------------------ salud
    @app.get("/health")
    async def health(d: Deps = Depends(get_deps)) -> dict:
        return {
            "status": "ok",
            "version": __version__,
            "providers": d.summary(),
            "sessions": len(d.sessions),
        }

    # ------------------------------------------------------------------ sesiones
    @app.post(
        "/v1/sessions",
        response_model=CreateSessionResponse,
        dependencies=[Depends(require_api_key)],
    )
    async def create_session(body: CreateSessionRequest, d: Deps = Depends(get_deps)):
        session = d.sessions.create(body.user_id, body.language or d.settings.default_language)
        return CreateSessionResponse(session_id=session.id, ws_path=f"/ws/{session.id}")

    @app.delete(
        "/v1/sessions/{session_id}", status_code=204, dependencies=[Depends(require_api_key)]
    )
    async def delete_session(session_id: str, d: Deps = Depends(get_deps)):
        d.sessions.delete(session_id)
        return Response(status_code=204)

    @app.get("/v1/sessions/{session_id}/state", dependencies=[Depends(require_api_key)])
    async def session_state(session: Session = Depends(get_session)) -> dict:
        return session.state_message()

    @app.post(
        "/v1/sessions/{session_id}/location",
        response_model=MessagesResponse,
        dependencies=[Depends(require_api_key)],
    )
    async def update_location(
        body: LocationUpdate, session: Session = Depends(get_session), d: Deps = Depends(get_deps)
    ):
        messages = await d.assistant.handle_location(
            session,
            body.lat,
            body.lng,
            heading=body.heading,
            speed=body.speed,
            accuracy=body.accuracy,
        )
        return MessagesResponse(messages=messages)

    @app.post(
        "/v1/sessions/{session_id}/utterance",
        response_model=MessagesResponse,
        dependencies=[Depends(require_api_key)],
    )
    async def utterance(
        body: UtteranceRequest, session: Session = Depends(get_session), d: Deps = Depends(get_deps)
    ):
        return MessagesResponse(messages=await d.assistant.handle_utterance(session, body.text))

    @app.post(
        "/v1/sessions/{session_id}/voice",
        response_model=VoiceResponse,
        dependencies=[Depends(require_api_key)],
    )
    async def voice(
        file: UploadFile = File(...),
        language: str = Form("es"),
        session: Session = Depends(get_session),
        d: Deps = Depends(get_deps),
    ):
        audio = await file.read()
        if not audio:
            raise HTTPException(status_code=400, detail="Audio vacío")
        transcript = await d.transcriber.transcribe(audio, file.filename or "command.m4a", language)
        if not transcript:
            return VoiceResponse(
                transcript="",
                messages=[
                    {
                        "type": "speak",
                        "text": "No te escuché bien. Inténtalo de nuevo.",
                        "priority": 2,
                        "interrupt": False,
                    }
                ],
            )
        return VoiceResponse(
            transcript=transcript, messages=await d.assistant.handle_utterance(session, transcript)
        )

    @app.post(
        "/v1/sessions/{session_id}/frame",
        response_model=FrameResponse,
        dependencies=[Depends(require_api_key)],
    )
    async def frame(
        request: Request, session: Session = Depends(get_session), d: Deps = Depends(get_deps)
    ):
        jpeg = await request.body()
        if not jpeg:
            raise HTTPException(status_code=400, detail="Fotograma vacío")
        alert = await d.pipeline.process(session, jpeg)
        return FrameResponse(alert=alert.to_message() if alert else None)

    # ------------------------------------------------------------------ lugares guardados
    @app.get("/v1/sessions/{session_id}/places", dependencies=[Depends(require_api_key)])
    async def list_places(session: Session = Depends(get_session)) -> list[dict]:
        return [vars(p) for p in session.saved_places.values()]

    @app.put("/v1/sessions/{session_id}/places", dependencies=[Depends(require_api_key)])
    async def put_place(body: SavedPlaceIn, session: Session = Depends(get_session)) -> dict:
        session.saved_places[body.alias] = SavedPlace(
            alias=body.alias, name=body.name, lat=body.lat, lon=body.lng, address=body.address
        )
        return {"ok": True, "count": len(session.saved_places)}

    # ------------------------------------------------------------------ TTS en la nube (opcional)
    @app.post("/v1/tts", dependencies=[Depends(require_api_key)])
    async def tts(body: TtsRequest, d: Deps = Depends(get_deps)):
        if d.tts is None:
            raise HTTPException(status_code=503, detail="TTS en la nube no configurado")
        audio = await d.tts.synthesize(body.text, voice=body.voice)
        return Response(content=audio, media_type="audio/mpeg")

    # ------------------------------------------------------------------ Uber OAuth
    @app.get("/v1/uber/oauth/url", dependencies=[Depends(require_api_key)])
    async def uber_oauth_url(session_id: str, d: Deps = Depends(get_deps)) -> dict:
        if not isinstance(d.rides, UberApiClient):
            raise HTTPException(
                status_code=400, detail="El proveedor de Uber no usa OAuth (deep link)"
            )
        if d.sessions.get(session_id) is None:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        return {"url": d.rides.authorize_url(state=session_id)}

    @app.post("/v1/sessions/{session_id}/uber/token", dependencies=[Depends(require_api_key)])
    async def uber_token(
        body: UberCodeRequest, session: Session = Depends(get_session), d: Deps = Depends(get_deps)
    ) -> dict:
        if not isinstance(d.rides, UberApiClient):
            raise HTTPException(status_code=400, detail="El proveedor de Uber no usa OAuth")
        try:
            token = await d.rides.exchange_code(body.code)
        except RideError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        session.uber_token = token.get("access_token")
        return {"ok": True, "expires_in": token.get("expires_in")}

    @app.get("/v1/uber/oauth/callback")
    async def uber_callback(code: str, state: str, d: Deps = Depends(get_deps)):
        session = d.sessions.get(state)
        if session is None or not isinstance(d.rides, UberApiClient):
            raise HTTPException(status_code=400, detail="Estado inválido")
        try:
            token = await d.rides.exchange_code(code)
        except RideError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        session.uber_token = token.get("access_token")
        return HTMLResponse("<h1>Uber vinculado</h1><p>Ya puedes volver a Faro.</p>")

    # ------------------------------------------------------------------ WebSocket en tiempo real
    @app.websocket("/ws/{session_id}")
    async def ws_endpoint(websocket: WebSocket, session_id: str, key: str | None = None):
        d: Deps = websocket.app.state.deps
        if d.settings.api_shared_secret and key != d.settings.api_shared_secret:
            await websocket.close(code=4401)
            return
        session = d.sessions.get(session_id)
        if session is None:
            await websocket.close(code=4404)
            return
        await websocket.accept()
        await websocket.send_json(session.state_message())
        try:
            while True:
                message = await websocket.receive()
                if message.get("type") == "websocket.disconnect":
                    break
                data = message.get("bytes")
                if data is not None:
                    alert = await d.pipeline.process(session, data)
                    if alert is not None:
                        await websocket.send_json(alert.to_message())
                        await websocket.send_json(
                            {
                                "type": "haptic",
                                "pattern": "danger" if alert.priority <= 1 else "warning",
                            }
                        )
                    continue
                text = message.get("text")
                if text is None:
                    continue
                try:
                    payload = json.loads(text)
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "message": "JSON inválido"})
                    continue
                for out in await d.assistant.handle_client_message(session, payload):
                    await websocket.send_json(out)
        except WebSocketDisconnect:
            pass
        finally:
            session.touch()

    return app
