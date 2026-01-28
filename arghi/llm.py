"""LLM client with request-scoped API key support."""

import os
from contextvars import ContextVar
from typing import Optional

from google import genai

_request_api_key: ContextVar[Optional[str]] = ContextVar('request_api_key', default=None)


class LLMConfigurationError(Exception):
    """Raised when LLM is not properly configured."""
    pass


class LLMNotConfigured(LLMConfigurationError):
    """Raised when no API key or project is available."""
    pass


class LLMCallError(RuntimeError):
    """Raised when an LLM call fails."""
    pass


def set_request_api_key(api_key: Optional[str]) -> None:
    """Set the API key for the current request context."""
    _request_api_key.set(api_key)


def get_request_api_key() -> Optional[str]:
    """Get the API key for the current request context."""
    return _request_api_key.get()


def init_llm_client(
    api_key: Optional[str] = None,
    project: Optional[str] = None,
    location: Optional[str] = None,
) -> genai.Client:
    """Initialize LLM client with Gemini API key or Google Cloud Project."""
    gemini_api_key = api_key or get_request_api_key() or os.getenv("GEMINI_API_KEY")
    google_cloud_project = project or os.getenv("GOOGLE_CLOUD_PROJECT")
    google_cloud_location = location or os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

    if gemini_api_key:
        return genai.Client(api_key=gemini_api_key)

    if google_cloud_project:
        return genai.Client(
            vertexai=True,
            project=google_cloud_project,
            location=google_cloud_location,
        )

    raise LLMNotConfigured(
        "No LLM configuration found. Provide a Gemini API key or set GOOGLE_CLOUD_PROJECT."
    )


def call_llm(
    prompt: str,
    model: str = "gemini-2.5-flash",
    temperature: float = 0.0,
) -> str:
    """Call LLM and return response text."""
    client = init_llm_client()

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            temperature=temperature,
        ),
    )

    if not response.text:
        raise LLMCallError("Empty response from LLM")

    return response.text
