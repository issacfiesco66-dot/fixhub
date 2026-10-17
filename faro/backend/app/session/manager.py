"""Estado por usuario: posición, lugares guardados, confirmaciones pendientes, ruta activa.

Implementación en memoria. En producción, respaldar en Redis para varios réplicas.
"""

from __future__ import annotations

import asyncio
import secrets
import time
from dataclasses import dataclass, field
from typing import Any

from ..vision.alert_policy import AlertPolicy


@dataclass
class Position:
    lat: float
    lon: float
    heading: float | None = None  # grados, brújula del teléfono
    speed: float | None = None  # m/s
    accuracy: float | None = None  # m
    at: float = field(default_factory=time.monotonic)


@dataclass
class SavedPlace:
    alias: str  # "home" | "work" | libre
    name: str  # "Casa"
    lat: float
    lon: float
    address: str | None = None


@dataclass
class PendingAction:
    kind: str  # ride | ride_destination | navigate
    payload: Any
    expires_at: float
    prompt: str = ""


@dataclass
class Session:
    id: str
    user_id: str
    language: str = "es"
    created_at: float = field(default_factory=time.monotonic)
    last_seen_at: float = field(default_factory=time.monotonic)
    position: Position | None = None
    saved_places: dict[str, SavedPlace] = field(default_factory=dict)
    pending: PendingAction | None = None
    guide: Any = None  # RouteGuide
    active_ride: Any = None  # RideRequestResult
    last_spoken: str | None = None
    alerts_enabled: bool = True
    alert_policy: AlertPolicy = field(default_factory=AlertPolicy)
    uber_token: str | None = None
    # Visión
    last_frame: bytes | None = None
    last_frame_at: float = 0.0
    last_processed_at: float | None = None
    last_vlm_at: float = float("-inf")
    vlm_cache: tuple[float, list] | None = None
    vlm_task: asyncio.Task | None = None

    def touch(self) -> None:
        self.last_seen_at = time.monotonic()

    def pending_kind(self) -> str | None:
        if self.pending is None:
            return None
        if self.pending.expires_at < time.monotonic():
            self.pending = None
            return None
        return self.pending.kind

    def state_message(self) -> dict:
        return {
            "type": "state",
            "navigating": self.guide is not None and not self.guide.finished,
            "pending": self.pending_kind(),
            "alerts_enabled": self.alerts_enabled,
            "ride_active": self.active_ride is not None,
            "has_position": self.position is not None,
        }


class SessionManager:
    def __init__(self, *, ttl_s: int = 6 * 3600, alert_policy_factory=AlertPolicy) -> None:
        self.ttl_s = ttl_s
        self._sessions: dict[str, Session] = {}
        self._alert_policy_factory = alert_policy_factory

    def create(self, user_id: str = "anon", language: str = "es") -> Session:
        self.cleanup()
        sid = secrets.token_urlsafe(16)
        session = Session(
            id=sid,
            user_id=user_id,
            language=language,
            alert_policy=self._alert_policy_factory(),
        )
        self._sessions[sid] = session
        return session

    def get(self, session_id: str) -> Session | None:
        session = self._sessions.get(session_id)
        if session is not None:
            session.touch()
        return session

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def cleanup(self) -> None:
        now = time.monotonic()
        for sid in [s for s, v in self._sessions.items() if now - v.last_seen_at > self.ttl_s]:
            self._sessions.pop(sid, None)

    def __len__(self) -> int:
        return len(self._sessions)
