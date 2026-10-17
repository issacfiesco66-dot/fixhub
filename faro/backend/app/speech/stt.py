"""Speech-to-Text con la API de audio de OpenAI (gpt-4o-mini-transcribe, fallback whisper-1)."""

from __future__ import annotations

import logging
from typing import Protocol

log = logging.getLogger(__name__)

VOCAB_HINT_ES = (
    "Comandos para un asistente de navegación: Uber, taxi, casa, trabajo, llévame a, "
    "cómo llego a, pedir un Uber a, cancelar, confirmar, sí, no, qué hay delante, dónde estoy, "
    "repite, ayuda."
)


class Transcriber(Protocol):
    async def transcribe(self, audio: bytes, filename: str, language: str = "es") -> str: ...


class OpenAITranscriber:
    def __init__(
        self,
        api_key: str,
        *,
        model: str = "gpt-4o-mini-transcribe",
        fallback_model: str = "whisper-1",
        timeout_s: float = 15.0,
    ) -> None:
        import openai

        self._openai = openai
        self.client = openai.AsyncOpenAI(api_key=api_key, timeout=timeout_s, max_retries=1)
        self.model = model
        self.fallback_model = fallback_model

    async def transcribe(self, audio: bytes, filename: str, language: str = "es") -> str:
        for model in (self.model, self.fallback_model):
            if not model:
                continue
            try:
                response = await self.client.audio.transcriptions.create(
                    model=model,
                    file=(filename, audio),
                    language=language,
                    prompt=VOCAB_HINT_ES,
                    response_format="json",
                )
                return (response.text or "").strip()
            except self._openai.OpenAIError as exc:
                log.warning("STT con %s falló: %s", model, exc)
        return ""


class FakeTranscriber:
    def __init__(self, text: str = "") -> None:
        self.text = text

    async def transcribe(self, audio: bytes, filename: str, language: str = "es") -> str:
        return self.text
