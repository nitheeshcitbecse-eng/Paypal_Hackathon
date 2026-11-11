"""
Makes ONE real AI call and shows exactly what happens (never prints your full key).
  python -m agentguard_ai.check_llm
"""
import asyncio
import os
import sys

from dotenv import find_dotenv, load_dotenv

from .llm import DEFAULT_MODELS, create_llm_client

ENV_PATH = find_dotenv(usecwd=True)
load_dotenv(ENV_PATH)


def hints(provider: str, key: str, err: str = "") -> list:
    out = []
    if key.startswith("gsk_") and provider != "groq":
        out.append("Your key is a GROQ key (gsk_...) but LLM_PROVIDER is not groq. Put LLM_PROVIDER=groq in .env.")
    if key.startswith("sk-ant") and provider != "anthropic":
        out.append("Your key looks like an Anthropic key. Set LLM_PROVIDER=anthropic.")
    if provider == "groq" and key and not key.startswith("gsk_"):
        out.append("A Groq key should start with gsk_. Copy it again from console.groq.com/keys.")
    if key != key.strip() or '"' in key or "'" in key or " " in key:
        out.append("The key has spaces or quotes. In .env write it as LLM_API_KEY=gsk_xxx with no quotes or spaces.")
    low = err.lower()
    if "401" in low or "invalid api key" in low or "authentication" in low:
        out.append("The provider rejected the key. Create a new key and paste it again.")
    if "404" in low or ("model" in low and "not" in low):
        out.append("The model name may be wrong or retired. Set LLM_MODEL=... in .env (see the provider's model list).")
    if "429" in low or "rate" in low:
        out.append("Rate limit hit. Wait a minute and try again.")
    if "connect" in low or "timeout" in low or "resolve" in low:
        out.append("Network problem. Check your internet, VPN or firewall.")
    return out


async def list_models(provider: str, key: str) -> list:
    """Ask the provider which model IDs this key can use (Groq / OpenAI only)."""
    if provider not in ("groq", "openai"):
        return []
    from openai import AsyncOpenAI

    kwargs = {"api_key": key}
    if provider == "groq":
        kwargs["base_url"] = "https://api.groq.com/openai/v1"
    client = AsyncOpenAI(**kwargs)
    page = await client.models.list()
    ids = sorted(m.id for m in page.data)
    skip = ("whisper", "tts", "guard", "embed", "orpheus", "playai")
    return [i for i in ids if not any(x in i.lower() for x in skip)]


async def main() -> int:
    provider = (os.getenv("LLM_PROVIDER") or "").strip().lower()
    defaulted = not provider
    provider = provider or "anthropic"
    key = os.getenv("LLM_API_KEY") or ""
    model = os.getenv("LLM_MODEL") or DEFAULT_MODELS.get(provider, "?")

    print(f".env file : {ENV_PATH or 'NOT FOUND (it must be named .env and sit in this folder)'}")
    print(f"provider  : {provider}" + ("   <-- LLM_PROVIDER is not set, defaulting to anthropic!" if defaulted else ""))
    print(f"model     : {model}")
    print(f'key       : {len(key)} characters, starts with "{key[:4]}"')
    for h in hints(provider, key):
        print(f"HINT      : {h}")

    try:
        llm = create_llm_client()
    except Exception as e:
        print(f"\nFAILED to create the client: {e}")
        return 1
    try:
        reply = await llm("Reply with only the word OK.", "ping")
    except Exception as e:
        err = f"{type(e).__name__}: {e}"
        print(f"\nCALL FAILED -> {err}")
        for h in hints(provider, key, err):
            print(f"HINT      : {h}")
        if "404" in err or "NotFound" in err:
            try:
                ids = await list_models(provider, key)
                if ids:
                    print("\nModels your key CAN use (copy one into .env as LLM_MODEL=...):")
                    for i in ids:
                        print(f"  {i}")
            except Exception as e2:
                print(f"\n(Could not fetch the model list: {type(e2).__name__})")
        return 1
    print(f"\nSUCCESS. The AI replied: {reply.strip()[:80]}")
    print("Now run: python -m agentguard_ai.demo")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
