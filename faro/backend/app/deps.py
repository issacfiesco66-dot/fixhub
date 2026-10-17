"""Construcción de dependencias (proveedores reales o falsos según configuración)."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from .assistant import Assistant
from .config import Settings
from .navigation.google_maps import FakeMapsClient, GoogleMapsClient, MapsClient
from .rides.flow import RideFlow
from .rides.uber import FakeRideProvider, RideProvider, UberApiClient, UberDeepLinkProvider
from .session.manager import SessionManager
from .speech.stt import FakeTranscriber, OpenAITranscriber, Transcriber
from .speech.tts import OpenAISpeechSynthesizer, SpeechSynthesizer
from .vision.alert_policy import AlertPolicy
from .vision.detector import Detector, FakeDetector, YoloDetector
from .vision.pipeline import VisionPipeline
from .vision.vlm import ClaudeVisionAnalyzer

log = logging.getLogger(__name__)


@dataclass
class Deps:
    settings: Settings
    sessions: SessionManager
    detector: Detector | None
    vlm: ClaudeVisionAnalyzer | None
    pipeline: VisionPipeline
    transcriber: Transcriber
    tts: SpeechSynthesizer | None
    maps: MapsClient
    rides: RideProvider
    ride_flow: RideFlow
    assistant: Assistant

    def summary(self) -> dict:
        return {
            "vision_backend": self.settings.vision_backend,
            "detector": type(self.detector).__name__ if self.detector else None,
            "vlm": self.settings.vlm_model if self.vlm else None,
            "stt": type(self.transcriber).__name__,
            "tts": type(self.tts).__name__ if self.tts else None,
            "maps": type(self.maps).__name__,
            "rides": self.rides.name,
        }


def build_deps(settings: Settings) -> Deps:
    detector: Detector | None = None
    if settings.vision_backend == "fake":
        detector = FakeDetector()
    elif settings.vision_backend in ("yolo", "hybrid"):
        try:
            detector = YoloDetector(
                settings.yolo_model_path,
                settings.yolo_hazard_model_path,
                confidence=settings.yolo_confidence,
                horizontal_fov_deg=settings.camera_horizontal_fov_deg,
            )
        except RuntimeError as exc:
            log.warning("Detector YOLO no disponible (%s); se usará solo el VLM si hay clave.", exc)

    vlm = None
    if settings.anthropic_api_key and settings.vision_backend in ("vlm", "hybrid"):
        vlm = ClaudeVisionAnalyzer(
            settings.anthropic_api_key,
            model=settings.vlm_model,
            timeout_s=settings.vlm_timeout_s,
            max_edge_px=settings.vlm_max_edge_px,
        )
    elif settings.vision_backend in ("vlm", "hybrid"):
        log.warning("ANTHROPIC_API_KEY vacío: el análisis VLM queda desactivado.")

    pipeline = VisionPipeline(
        backend=settings.vision_backend,
        detector=detector,
        vlm=vlm,
        frame_min_interval_s=settings.frame_min_interval_s,
        vlm_interval_s=settings.vlm_interval_s,
    )

    transcriber: Transcriber = (
        OpenAITranscriber(
            settings.openai_api_key,
            model=settings.stt_model,
            fallback_model=settings.stt_fallback_model,
        )
        if settings.openai_api_key
        else FakeTranscriber()
    )
    tts: SpeechSynthesizer | None = (
        OpenAISpeechSynthesizer(
            settings.openai_api_key, model=settings.tts_model, voice=settings.tts_voice
        )
        if settings.openai_api_key
        else None
    )
    maps: MapsClient = (
        GoogleMapsClient(settings.google_maps_api_key)
        if settings.google_maps_api_key
        else FakeMapsClient()
    )
    if settings.uber_provider == "fake":
        rides: RideProvider = FakeRideProvider()
    elif settings.uber_provider == "api":
        rides = UberApiClient(
            client_id=settings.uber_client_id,
            client_secret=settings.uber_client_secret,
            server_token=settings.uber_server_token,
            redirect_uri=settings.uber_redirect_uri,
            sandbox=settings.uber_use_sandbox,
        )
    else:
        rides = UberDeepLinkProvider(settings.uber_client_id)

    ride_flow = RideFlow(rides, maps, search_radius_m=settings.places_search_radius_m)
    assistant = Assistant(
        maps=maps,
        ride_flow=ride_flow,
        vlm=vlm,
        pipeline=pipeline,
        reroute_threshold_m=settings.reroute_threshold_m,
        arrival_radius_m=settings.arrival_radius_m,
        search_radius_m=settings.places_search_radius_m,
    )

    def policy_factory() -> AlertPolicy:
        return AlertPolicy(
            cooldown_s=settings.alert_cooldown_s,
            min_interval_s=settings.alert_min_interval_s,
            max_distance_m=settings.alert_max_distance_m,
            vehicle_max_distance_m=settings.vehicle_max_distance_m,
        )

    sessions = SessionManager(ttl_s=settings.session_ttl_s, alert_policy_factory=policy_factory)
    return Deps(
        settings=settings,
        sessions=sessions,
        detector=detector,
        vlm=vlm,
        pipeline=pipeline,
        transcriber=transcriber,
        tts=tts,
        maps=maps,
        rides=rides,
        ride_flow=ride_flow,
        assistant=assistant,
    )
