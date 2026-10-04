"""
Provider-agnostic LLM/VLM client.

Every agent that needs a language or vision-language model call goes
through here instead of calling a provider SDK directly, so DocuMind can
switch between the hosted Gemini API and a local Ollama model with a single
config flag (`LLM_PROVIDER`) — useful for development without an API key,
and swappable back to Gemini for production without touching agent code.
"""

import base64

import cv2
import httpx
import numpy as np

from config import get_settings
from utils.logger import logger

settings = get_settings()


class LLMError(Exception):
    """Raised when the configured LLM/VLM backend fails to produce a response."""


def _encode_image_png(image: np.ndarray) -> str:
    success, buffer = cv2.imencode(".png", image)
    if not success:
        raise LLMError("Failed to encode image for LLM request")
    return base64.b64encode(buffer.tobytes()).decode("utf-8")


def _ollama_generate(
    prompt: str, image: np.ndarray | None, temperature: float, json_mode: bool
) -> str:
    model = settings.ollama_vision_model if image is not None else settings.ollama_text_model
    payload: dict = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if image is not None:
        payload["images"] = [_encode_image_png(image)]
    if json_mode:
        payload["format"] = "json"

    try:
        response = httpx.post(
            f"{settings.ollama_base_url}/api/generate", json=payload, timeout=120.0
        )
        response.raise_for_status()
        return response.json()["response"]
    except httpx.HTTPError as exc:
        logger.error(f"Ollama request failed: {exc}")
        raise LLMError(f"Ollama request failed: {exc}") from exc


def _gemini_generate(
    prompt: str, image: np.ndarray | None, temperature: float, json_mode: bool
) -> str:
    import google.generativeai as genai
    from PIL import Image

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(settings.gemini_model_name)

    generation_config = genai.types.GenerationConfig(
        temperature=temperature,
        response_mime_type="application/json" if json_mode else "text/plain",
    )

    contents: list = [prompt]
    if image is not None:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        contents.append(Image.fromarray(rgb))

    try:
        response = model.generate_content(contents, generation_config=generation_config)
        return response.text
    except Exception as exc:
        logger.error(f"Gemini request failed: {exc}")
        raise LLMError(f"Gemini request failed: {exc}") from exc


def generate(
    prompt: str,
    image: np.ndarray | None = None,
    temperature: float = 0.2,
    json_mode: bool = False,
) -> str:
    """Generate a text (or JSON) completion, optionally grounded in an image, via the configured provider."""
    if settings.llm_provider == "ollama":
        return _ollama_generate(prompt, image, temperature, json_mode)
    return _gemini_generate(prompt, image, temperature, json_mode)
