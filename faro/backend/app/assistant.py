"""Orquestador de comandos de voz: intención -> módulo -> mensajes para la app.

Los mensajes salientes son dicts JSON que la app reproduce con TTS/háptica:
  {"type": "speak", "text": ..., "priority": 0-3, "interrupt": bool}
  {"type": "nav", "event": ..., "text": ...}
  {"type": "open_url", "url": ...}            (deep link de Uber)
  {"type": "state", ...}
"""

from __future__ import annotations

import logging
import time

from .navigation.geo import cardinal_es
from .navigation.google_maps import LatLng, MapsClient, MapsError
from .navigation.guidance import RouteGuide
from .navigation.places import ALIAS_LABEL_ES, resolve_destination
from .rides.flow import RideFlow
from .session.manager import Position, SavedPlace, Session
from .speech.intents import (
    Intent,
    ParsedCommand,
    destination_from_free_text,
    parse_command,
    resolve_alias,
)

log = logging.getLogger(__name__)

HELP_TEXT = (
    "Puedes decir: llévame a un lugar; pedir un Uber a casa; qué hay delante; dónde estoy; "
    "guarda este lugar como casa; conecta las gafas; silenciar alertas; o cancelar."
)


def speak(text: str, priority: int = 2, interrupt: bool = False) -> dict:
    return {"type": "speak", "text": text, "priority": priority, "interrupt": interrupt}


class Assistant:
    def __init__(
        self,
        *,
        maps: MapsClient,
        ride_flow: RideFlow,
        vlm=None,
        pipeline=None,
        reroute_threshold_m: float = 25.0,
        arrival_radius_m: float = 10.0,
        search_radius_m: float = 5000.0,
        clock=time.monotonic,
    ) -> None:
        self.maps = maps
        self.ride_flow = ride_flow
        self.vlm = vlm
        self.pipeline = pipeline
        self.reroute_threshold_m = reroute_threshold_m
        self.arrival_radius_m = arrival_radius_m
        self.search_radius_m = search_radius_m
        self._clock = clock

    # ------------------------------------------------------------------ entrada genérica
    async def handle_client_message(self, session: Session, payload: dict) -> list[dict]:
        kind = payload.get("type")
        if kind == "location":
            return await self.handle_location(
                session,
                float(payload["lat"]),
                float(payload["lng"]),
                heading=payload.get("heading"),
                speed=payload.get("speed"),
                accuracy=payload.get("accuracy"),
            )
        if kind == "utterance":
            return await self.handle_utterance(session, str(payload.get("text", "")))
        if kind == "ping":
            return [{"type": "pong"}]
        if kind == "get_state":
            return [session.state_message()]
        return [{"type": "error", "message": f"Mensaje desconocido: {kind}"}]

    # ------------------------------------------------------------------ localización
    async def handle_location(
        self, session: Session, lat: float, lng: float, *, heading=None, speed=None, accuracy=None
    ) -> list[dict]:
        session.position = Position(
            lat=lat,
            lon=lng,
            heading=float(heading) if heading is not None else None,
            speed=float(speed) if speed is not None else None,
            accuracy=float(accuracy) if accuracy is not None else None,
        )
        guide: RouteGuide | None = session.guide
        if guide is None or guide.finished:
            return []
        out: list[dict] = []
        for ev in guide.update(lat, lng, session.position.heading, now=self._clock()):
            if ev.kind == "reroute":
                out += await self._reroute(session)
            else:
                out.append(ev.to_message())
                session.last_spoken = ev.text
            if ev.kind == "arrived":
                session.guide = None
        return out

    async def _reroute(self, session: Session) -> list[dict]:
        guide: RouteGuide = session.guide
        pos = session.position
        assert pos is not None
        try:
            route = await self.maps.walking_route(
                LatLng(lat=pos.lat, lng=pos.lon),
                guide.route.destination,
                language=session.language,
                destination_name=guide.label,
            )
        except MapsError as exc:
            log.warning("Recalculo falló: %s", exc)
            return [speak("No pude recalcular la ruta. Sigue con cuidado.", 1)]
        session.guide = self._make_guide(route, guide.label)
        text = "Ruta recalculada. " + session.guide.start_text(pos.heading)
        session.last_spoken = text
        return [{"type": "nav", "event": "reroute", "text": text, "priority": 1}]

    def _make_guide(self, route, label: str) -> RouteGuide:
        return RouteGuide(
            route,
            label,
            reroute_threshold_m=self.reroute_threshold_m,
            arrival_radius_m=self.arrival_radius_m,
            clock=self._clock,
        )

    # ------------------------------------------------------------------ voz
    async def handle_utterance(self, session: Session, text: str) -> list[dict]:
        pending_kind = session.pending_kind()
        cmd = parse_command(text, awaiting_confirmation=pending_kind in ("ride", "navigate"))
        log.info("utterance=%r intent=%s dest=%r", text, cmd.intent.value, cmd.destination)

        # El usuario está respondiendo "¿a dónde?" con un destino suelto.
        if pending_kind == "ride_destination" and cmd.intent in (Intent.UNKNOWN, Intent.NAVIGATE):
            session.pending = None
            dest = cmd.destination or destination_from_free_text(cmd.normalized)
            alias = cmd.place_alias or resolve_alias(dest)
            return self._say(session, await self.ride_flow.start(session, dest, alias))

        handler = {
            Intent.NAVIGATE: self._navigate,
            Intent.RIDE_REQUEST: self._ride,
            Intent.CONFIRM: self._confirm,
            Intent.CANCEL: self._cancel,
            Intent.STOP_NAVIGATION: self._stop_navigation,
            Intent.DESCRIBE_SCENE: self._describe,
            Intent.WHERE_AM_I: self._where_am_i,
            Intent.REPEAT: self._repeat,
            Intent.HELP: self._help,
            Intent.SAVE_PLACE: self._save_place,
            Intent.TOGGLE_ALERTS: self._toggle_alerts,
            Intent.CONNECT_GLASSES: self._connect_glasses,
        }.get(cmd.intent, self._unknown)
        return await handler(session, cmd)

    def _say(
        self,
        session: Session,
        text: str,
        priority: int = 2,
        extra: list[dict] | None = None,
        remember: bool = True,
    ) -> list[dict]:
        if remember:
            session.last_spoken = text
        return [speak(text, priority)] + (extra or [])

    async def _navigate(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        if session.position is None:
            return self._say(session, "Aún no tengo tu ubicación. Espera unos segundos.")
        place = await resolve_destination(
            self.maps, session, cmd.destination, cmd.place_alias, radius_m=self.search_radius_m
        )
        if place is None:
            if cmd.place_alias in ALIAS_LABEL_ES:
                label = ALIAS_LABEL_ES[cmd.place_alias]
                return self._say(
                    session, f"No tienes guardado {label}. Di: guarda este lugar como {label}."
                )
            return self._say(
                session, f"No encontré {cmd.destination}. Intenta con otro nombre o dirección."
            )
        pos = session.position
        try:
            route = await self.maps.walking_route(
                LatLng(lat=pos.lat, lng=pos.lon),
                place.location,
                language=session.language,
                destination_name=place.name,
            )
        except MapsError as exc:
            log.warning("Ruta falló: %s", exc)
            return self._say(session, f"No pude calcular una ruta a pie hasta {place.name}.")
        session.guide = self._make_guide(route, place.name)
        text = session.guide.start_text(pos.heading)
        session.last_spoken = text
        return [
            {"type": "nav", "event": "start", "text": text, "priority": 1},
            session.state_message(),
        ]

    async def _ride(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        text = await self.ride_flow.start(session, cmd.destination, cmd.place_alias)
        return self._say(session, text) + [session.state_message()]

    async def _confirm(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        kind = session.pending_kind()
        if kind == "ride":
            text, extra = await self.ride_flow.confirm(session)
            return self._say(session, text, 1, extra) + [session.state_message()]
        if kind == "navigate":
            pending = session.pending
            session.pending = None
            return await self._navigate(session, pending.payload)
        return self._say(session, "No hay nada pendiente por confirmar.")

    async def _cancel(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        if session.pending_kind() is not None:
            session.pending = None
            return self._say(session, "Cancelado.") + [session.state_message()]
        if session.active_ride is not None:
            return self._say(session, await self.ride_flow.cancel(session)) + [
                session.state_message()
            ]
        if session.guide is not None:
            session.guide = None
            return self._say(session, "Navegación detenida.") + [session.state_message()]
        return self._say(session, "No hay nada que cancelar.")

    async def _stop_navigation(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        if session.guide is None:
            return self._say(session, "No hay ninguna ruta activa.")
        session.guide = None
        return self._say(session, "Navegación detenida.") + [session.state_message()]

    async def _describe(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        if self.vlm is None:
            return self._say(
                session, "La descripción de escena no está disponible en este servidor."
            )
        if not session.last_frame:
            return self._say(session, "Todavía no recibo imagen de la cámara.")
        import io

        from PIL import Image

        try:
            image = Image.open(io.BytesIO(session.last_frame)).convert("RGB")
            text = await self.vlm.describe(image)
        except Exception as exc:  # noqa: BLE001
            log.warning("describe falló: %s", exc)
            text = ""
        return self._say(session, text or "No pude describir la escena. Inténtalo de nuevo.")

    async def _where_am_i(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        pos = session.position
        if pos is None:
            return self._say(session, "Aún no tengo tu ubicación.")
        try:
            address = await self.maps.reverse_geocode(
                LatLng(lat=pos.lat, lng=pos.lon), language=session.language
            )
        except MapsError:
            address = None
        if not address:
            return self._say(session, "No pude determinar la dirección exacta.")
        text = f"Estás en {address}"
        if pos.heading is not None:
            text += f", mirando hacia el {cardinal_es(pos.heading)}"
        return self._say(session, text + ".")

    async def _repeat(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        if session.pending is not None and session.pending.prompt:
            return [speak(session.pending.prompt)]
        return [speak(session.last_spoken or "No he dicho nada todavía.")]

    async def _help(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        return self._say(session, HELP_TEXT)

    async def _save_place(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        pos = session.position
        if pos is None:
            return self._say(session, "Aún no tengo tu ubicación para guardarla.")
        alias = cmd.place_alias or cmd.destination or "lugar"
        name = ALIAS_LABEL_ES.get(alias, cmd.destination or alias).replace("el ", "")
        try:
            address = await self.maps.reverse_geocode(
                LatLng(lat=pos.lat, lng=pos.lon), language=session.language
            )
        except MapsError:
            address = None
        session.saved_places[alias] = SavedPlace(
            alias=alias, name=name, lat=pos.lat, lon=pos.lon, address=address
        )
        return self._say(session, f"Guardado como {name}.")

    async def _toggle_alerts(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        enabled = bool(cmd.extra.get("enabled", True))
        session.alerts_enabled = enabled
        if enabled:
            session.alert_policy.reset()
        text = (
            "Alertas de obstáculos activadas." if enabled else "Alertas de obstáculos silenciadas."
        )
        return self._say(session, text) + [session.state_message()]

    async def _connect_glasses(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        # La vinculación ocurre en el teléfono (SDK de Meta); el backend solo da la orden.
        text = "Abriendo Meta AI para vincular tus gafas. Acepta la conexión y vuelve a Faro."
        return self._say(session, text, 1) + [
            {"type": "client_action", "action": "connect_glasses"}
        ]

    async def _unknown(self, session: Session, cmd: ParsedCommand) -> list[dict]:
        return self._say(
            session, "No entendí. Di ayuda para escuchar los comandos.", remember=False
        )
