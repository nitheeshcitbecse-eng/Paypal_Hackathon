"""Async LLM client. Any `async (system, user) -> str` works, which makes tests easy to fake.

Providers (set LLM_PROVIDER in .env):
  groq       free API key, OpenAI-compatible   (LLM_API_KEY=gsk_...)
  anthropic  Claude API, paid                  (LLM_API_KEY=sk-ant-...)
  openai     OpenAI API, paid                  (LLM_API_KEY=sk-...)
"""
import os
from typing import Awaitable, Callable, Optional

LLMClient = Callable[[str, str], Awaitable[str]]

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODELS = {
    "groq": "openai/gpt-oss-120b",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-sonnet-5-5",
}


def create_llm_client(provider: Optional[str] = None, api_key: Optional[str] = None,
                      model: Optional[str] = None) -> LLMClient:
    """Reads LLM_PROVIDER / LLM_API_KEY / LLM_MODEL from the environment unless overridden."""
    provider = (provider or os.getenv("LLM_PROVIDER") or "anthropic").strip().lower()
    api_key = api_key or os.getenv("LLM_API_KEY")
    if provider not in DEFAULT_MODELS:
        raise RuntimeError(f"Unknown LLM_PROVIDER \"{provider}\". Use: groq, anthropic or openai.")
    if not api_key or api_key.lower().startswith("paste-your"):
        raise RuntimeError("LLM_API_KEY is not set (put your real key in the .env file)")
    mdl = model or os.getenv("LLM_MODEL") or DEFAULT_MODELS[provider]

    if provider in ("groq", "openai"):
        from openai import AsyncOpenAI  # lazy import: only needed when used

        if provider == "groq":
            # max_retries lets the SDK wait and retry on the free tier's rate-limit (429) errors
            client = AsyncOpenAI(api_key=api_key, base_url=GROQ_BASE_URL, max_retries=5)
        else:
            client = AsyncOpenAI(api_key=api_key)

        async def call_openai_compatible(system: str, user: str) -> str:
            kwargs = dict(
                model=mdl,
                temperature=0,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            )
            if provider == "openai":  # Groq: the prompt already demands JSON-only, extract_json handles the rest
                kwargs["response_format"] = {"type": "json_object"}
            resp = await client.chat.completions.create(**kwargs)
            return resp.choices[0].message.content or ""

        return call_openai_compatible

    from anthropic import AsyncAnthropic  # lazy import

    aclient = AsyncAnthropic(api_key=api_key)

    async def call_anthropic(system: str, user: str) -> str:
        resp = await aclient.messages.create(
            model=mdl, max_tokens=500, system=system,
            messages=[{"role": "user", "content": user}],
        )
        return next((b.text for b in resp.content if b.type == "text"), "")

    return call_anthropic
