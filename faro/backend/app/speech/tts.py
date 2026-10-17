"""Text-to-Speech en la nube (opcional). Las alertas críticas se sintetizan en el teléfono."""

from __future__ import annotations

from typing import Protocol


class SpeechSynthesizer(Protocol):
    async def synthesize(self, text: str, *, voice: str | None = None) -> bytes: ...


class OpenAISpeechSynthesizer:
    def __init__(
        self, api_key: str, *, model: str = "gpt-4o-mini-tts", voice: str = "nova"
    ) -> None:
        import openai

        self.client = openai.AsyncOpenAI(api_key=api_key, timeout=20.0, max_retries=1)
        self.model = model
        self.voice = voice

    async def synthesize(self, text: str, *, voice: str | None = None) -> bytes:
        response = await self.client.audio.speech.create(
            model=self.model,
            voice=voice or self.voice,
            input=text,
            response_format="mp3",
            instructions="Voz clara y calmada, ritmo ágil, español neutro.",
        )
        return response.content
