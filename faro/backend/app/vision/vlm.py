"""Análisis de escena con un modelo de visión-lenguaje (Claude).

Cubre los peligros que el modelo COCO no conoce (escaleras, cables colgando, baches, postes)
mientras no exista un detector fine-tuned, y responde a "¿qué hay delante?".
"""

from __future__ import annotations

import base64
import io
import json
import logging

from PIL import Image
from pydantic import BaseModel, Field, ValidationError

from .hazards import BBox, Detection, HazardClass

log = logging.getLogger(__name__)

HAZARD_KINDS = [h.value for h in HazardClass]

HAZARD_SCHEMA = {
    "type": "object",
    "properties": {
        "hazards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": HAZARD_KINDS},
                    "horizontal": {"type": "string", "enum": ["left", "center", "right"]},
                    "vertical": {"type": "string", "enum": ["top", "middle", "bottom"]},
                    "distance_m": {"type": "number"},
                    "confidence": {"type": "number"},
                },
                "required": ["kind", "horizontal", "vertical", "distance_m", "confidence"],
                "additionalProperties": False,
            },
        },
        "scene": {"type": "string"},
    },
    "required": ["hazards", "scene"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = (
    "Eres el módulo de visión de un asistente para personas ciegas que caminan por la calle. "
    "Analizas una imagen tomada desde unas gafas a la altura de los ojos, mirando hacia delante. "
    "Devuelve únicamente los peligros físicos relevantes para quien camina, con estas clases: "
    "stairs_down (escaleras hacia abajo), stairs_up (escaleras hacia arriba), hanging_cable "
    "(cables, ramas u objetos colgando a la altura de la cabeza), pole (postes, señales o árboles "
    "en la trayectoria), pothole (baches, hoyos, rejillas abiertas), curb (bordillos o escalones "
    "aislados), vehicle (vehículos en movimiento o muy cercanos), bicycle (bicicletas, motos, "
    "patinetes), person (personas en la trayectoria inmediata), animal, obstacle (otros "
    "obstáculos a la altura del cuerpo). Ignora lo que esté a más de 10 metros, fuera de la "
    "trayectoria de marcha o que no suponga riesgo. horizontal: left/center/right según su "
    "posición en la imagen; vertical: top (por encima de la cabeza), middle, bottom (suelo). "
    "distance_m: distancia estimada en metros (0.5 a 15). confidence: 0 a 1. Sé conservador: "
    "una alerta falsa molesta, pero una omisión puede causar una caída. Máximo 4 peligros, "
    "del más urgente al menos urgente. 'scene' es una frase de máximo 15 palabras."
)

DESCRIBE_PROMPT = (
    "Describe la escena para una persona ciega en máximo dos frases cortas en español: primero "
    "obstáculos o peligros en su camino, después puntos de referencia útiles (puertas, cruces, "
    "semáforos, letreros con texto). Sin introducciones ni listas."
)


class VlmHazard(BaseModel):
    kind: HazardClass
    horizontal: str = "center"
    vertical: str = "middle"
    distance_m: float = 5.0
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class VlmResult(BaseModel):
    hazards: list[VlmHazard] = Field(default_factory=list)
    scene: str = ""


_ZONE_X = {"left": 0.17, "center": 0.5, "right": 0.83}
_ZONE_Y = {"top": 0.17, "middle": 0.5, "bottom": 0.83}


def vlm_hazard_to_detection(h: VlmHazard) -> Detection:
    cx = _ZONE_X.get(h.horizontal, 0.5)
    cy = _ZONE_Y.get(h.vertical, 0.5)
    half = 0.12
    return Detection(
        hazard=h.kind,
        confidence=h.confidence,
        bbox=BBox(cx - half, cy - half, cx + half, cy + half),
        source="vlm",
        label=h.kind.value,
        distance_m=max(0.5, min(30.0, float(h.distance_m))),
    )


def encode_jpeg_b64(image: Image.Image, max_edge_px: int = 768, quality: int = 75) -> str:
    img = image.convert("RGB")
    w, h = img.size
    scale = max(w, h) / float(max_edge_px)
    if scale > 1.0:
        img = img.resize((int(w / scale), int(h / scale)))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return base64.standard_b64encode(buf.getvalue()).decode("ascii")


def parse_vlm_json(text: str) -> VlmResult:
    try:
        return VlmResult.model_validate(json.loads(text))
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        log.warning("Respuesta VLM no válida: %s", exc)
        return VlmResult()


class ClaudeVisionAnalyzer:
    def __init__(
        self,
        api_key: str,
        *,
        model: str = "claude-sonnet-5-5",
        timeout_s: float = 8.0,
        max_edge_px: int = 768,
    ) -> None:
        import anthropic

        self._anthropic = anthropic
        self.client = anthropic.AsyncAnthropic(api_key=api_key, timeout=timeout_s, max_retries=1)
        self.model = model
        self.max_edge_px = max_edge_px

    async def detect_hazards(self, image: Image.Image) -> list[Detection]:
        result = await self.analyze(image)
        return [vlm_hazard_to_detection(h) for h in result.hazards]

    async def analyze(self, image: Image.Image) -> VlmResult:
        content = self._image_content(image, "Analiza la imagen y devuelve el JSON.")
        response = await self._create(
            system=SYSTEM_PROMPT,
            content=content,
            max_tokens=600,
            output_config={
                "effort": "low",
                "format": {"type": "json_schema", "schema": HAZARD_SCHEMA},
            },
        )
        if response is None:
            return VlmResult()
        return parse_vlm_json(_first_text(response))

    async def describe(self, image: Image.Image) -> str:
        content = self._image_content(image, "Describe lo que ves.")
        response = await self._create(
            system=DESCRIBE_PROMPT,
            content=content,
            max_tokens=200,
            output_config={"effort": "low"},
        )
        return _first_text(response).strip() if response is not None else ""

    def _image_content(self, image: Image.Image, prompt: str) -> list[dict]:
        return [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": encode_jpeg_b64(image, self.max_edge_px),
                },
            },
            {"type": "text", "text": prompt},
        ]

    async def _create(
        self, *, system: str, content: list[dict], max_tokens: int, output_config: dict
    ):
        anthropic = self._anthropic
        try:
            response = await self.client.beta.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": content}],
                output_config=output_config,
                # Si un clasificador de seguridad declina la petición, la API reintenta en un
                # modelo sustituto dentro de la misma llamada.
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
        except anthropic.RateLimitError as exc:
            log.info("VLM limitado por cuota: %s", exc)
            return None
        except anthropic.APIStatusError as exc:
            log.warning("VLM error HTTP %s: %s", exc.status_code, exc.message)
            return None
        except anthropic.APIConnectionError as exc:  # incluye APITimeoutError
            log.warning("VLM sin conexión/timeout: %s", exc)
            return None
        if response.stop_reason == "refusal":
            log.info("VLM declinó analizar el fotograma")
            return None
        return response


def _first_text(response) -> str:
    for block in response.content:
        if getattr(block, "type", "") == "text":
            return block.text
    return ""
