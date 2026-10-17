"""Configuración centralizada (variables de entorno / .env)."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["dev", "staging", "prod"] = "dev"
    log_level: str = "INFO"
    # Secreto compartido app <-> backend (cabecera X-API-Key). Vacío = sin auth (solo dev).
    api_shared_secret: str = ""
    default_language: str = "es"

    # --- Proveedores externos ---
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    google_maps_api_key: str = ""
    uber_client_id: str = ""
    uber_client_secret: str = ""
    uber_server_token: str = ""
    uber_redirect_uri: str = "faro://uber/callback"
    uber_use_sandbox: bool = True
    # deeplink: abre la app de Uber con destino precargado (no requiere scope privilegiado).
    # api: solicitud automática vía Ride Requests API (requiere aprobación de Uber).
    uber_provider: Literal["deeplink", "api", "fake"] = "deeplink"

    # --- Visión ---
    # yolo: solo detector local | vlm: solo modelo de visión-lenguaje | hybrid: ambos | fake: tests
    vision_backend: Literal["yolo", "vlm", "hybrid", "fake"] = "hybrid"
    yolo_model_path: str = "yolov8n.pt"
    yolo_hazard_model_path: str = ""  # modelo fine-tuned (escaleras, cables, postes, baches)
    yolo_confidence: float = 0.35
    vlm_model: str = "claude-sonnet-5-5"
    vlm_interval_s: float = 4.0
    vlm_timeout_s: float = 8.0
    camera_horizontal_fov_deg: float = 100.0  # Ray-Ban Meta: cámara ultra gran angular
    frame_min_interval_s: float = 0.25
    vlm_max_edge_px: int = 768

    # --- Política de alertas ---
    alert_cooldown_s: float = 3.0
    alert_min_interval_s: float = 1.2
    alert_max_distance_m: float = 8.0
    vehicle_max_distance_m: float = 15.0

    # --- Voz ---
    stt_model: str = "gpt-4o-mini-transcribe"
    stt_fallback_model: str = "whisper-1"
    tts_model: str = "gpt-4o-mini-tts"
    tts_voice: str = "nova"

    # --- Navegación ---
    reroute_threshold_m: float = 25.0
    arrival_radius_m: float = 10.0
    places_search_radius_m: float = 5000.0

    # --- Sesiones ---
    session_ttl_s: int = 6 * 3600


@lru_cache
def get_settings() -> Settings:
    return Settings()
