"""Modelos Pydantic de la API REST."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    user_id: str = "anon"
    language: str = "es"


class CreateSessionResponse(BaseModel):
    session_id: str
    ws_path: str


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    heading: float | None = None
    speed: float | None = None
    accuracy: float | None = None


class UtteranceRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class MessagesResponse(BaseModel):
    messages: list[dict]


class VoiceResponse(BaseModel):
    transcript: str
    messages: list[dict]


class FrameResponse(BaseModel):
    alert: dict | None


class SavedPlaceIn(BaseModel):
    alias: str = Field(pattern=r"^[a-z_]{1,32}$")
    name: str
    lat: float
    lng: float
    address: str | None = None


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    voice: str | None = None


class UberCodeRequest(BaseModel):
    code: str
