"""
GPT Client - Now using Google Gemini as backend
Backward compatible wrapper that uses Gemini instead of OpenAI.

Uses GEMINI_API_KEY from .env file (falls back to GPT_API_KEY).
"""

# Re-export everything from gemini_client for backward compatibility
from .gemini_client import (
    GeminiClient as GPTClient,
    GeminiConfig as GPTConfig,
    GeminiClientError as GPTClientError,
    GeminiRateLimitError as GPTRateLimitError,
    GeminiTimeoutError as GPTTimeoutError,
    GeminiAPIError as GPTAPIError,
    create_gemini_client as create_gpt_client,
    GeminiModel,
    GeminiClient,
    GeminiConfig,
)

__all__ = [
    'GPTClient',
    'GPTConfig', 
    'GPTClientError',
    'GPTRateLimitError',
    'GPTTimeoutError',
    'GPTAPIError',
    'create_gpt_client',
    'GeminiClient',
    'GeminiConfig',
    'GeminiModel',
]
