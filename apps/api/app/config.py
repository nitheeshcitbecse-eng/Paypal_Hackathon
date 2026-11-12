"""Backend configuration, read from environment variables (and .env files)."""
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

API_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = API_DIR.parents[1]

SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com"
DEFAULT_CORS = ["http://localhost:3000", "http://127.0.0.1:3000"]


def _bool(value: Optional[str], default: bool = False) -> bool:
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _clean(value: Optional[str]) -> Optional[str]:
    value = (value or "").strip()
    return value or None


@dataclass(frozen=True)
class Settings:
    db_path: str = str(API_DIR / "agentguard.db")
    cors_origins: List[str] = field(default_factory=lambda: list(DEFAULT_CORS))
    # "mock" (no money, no network) or "sandbox" (PayPal Developer Sandbox).
    paypal_mode: str = "mock"
    paypal_client_id: Optional[str] = None
    paypal_client_secret: Optional[str] = None
    paypal_base_url: str = SANDBOX_BASE_URL
    currency: str = "USD"
    # Offline = regex heuristics + rules only (no LLM call). Useful for demos without an API key.
    offline: bool = False
    llm_timeout: float = 30.0
    # When set, every /api route except /api/health requires the header `X-API-Key: <value>`.
    api_key: Optional[str] = None
    seed_demo_data: bool = True

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv(REPO_ROOT / ".env")              # shared .env (LLM_PROVIDER / LLM_API_KEY)
        load_dotenv(API_DIR / ".env", override=True)  # backend-only overrides

        client_id = _clean(os.getenv("PAYPAL_CLIENT_ID"))
        secret = _clean(os.getenv("PAYPAL_CLIENT_SECRET"))
        mode = (os.getenv("PAYPAL_MODE") or "auto").strip().lower()
        if mode == "auto":
            mode = "sandbox" if client_id and secret else "mock"
        if mode not in ("mock", "sandbox"):
            raise RuntimeError(f'PAYPAL_MODE must be "auto", "mock" or "sandbox" (got "{mode}").')
        if mode == "sandbox" and not (client_id and secret):
            raise RuntimeError("PAYPAL_MODE=sandbox needs PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.")

        origins = _clean(os.getenv("CORS_ORIGINS"))
        return cls(
            db_path=_clean(os.getenv("DATABASE_PATH")) or str(API_DIR / "agentguard.db"),
            cors_origins=[o.strip() for o in origins.split(",") if o.strip()] if origins else list(DEFAULT_CORS),
            paypal_mode=mode,
            paypal_client_id=client_id,
            paypal_client_secret=secret,
            paypal_base_url=_clean(os.getenv("PAYPAL_BASE_URL")) or SANDBOX_BASE_URL,
            currency=(_clean(os.getenv("CURRENCY")) or "USD").upper(),
            offline=_bool(os.getenv("AGENTGUARD_OFFLINE")),
            llm_timeout=float(os.getenv("LLM_TIMEOUT") or 30),
            api_key=_clean(os.getenv("AGENTGUARD_API_KEY")),
            seed_demo_data=_bool(os.getenv("SEED_DEMO_DATA"), default=True),
        )
