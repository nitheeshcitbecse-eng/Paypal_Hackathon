"""
AgentGuard FastAPI backend.

  cd apps/api
  uvicorn app.main:app --reload --port 5000     # or: python -m app
  open http://localhost:5000/docs
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional, Tuple

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings
from .engine import EVAL_MERCHANTS, EVAL_SETTINGS, LLMClient, create_llm_client
from .paypal import MockPayPal, PaymentGateway, PayPalSandbox
from .routes import public, router
from .service import AgentGuardService, ServiceError
from .store import Store

logger = logging.getLogger("agentguard_api")


async def _offline_llm(system: str, user: str) -> str:
    """Heuristics-only mode: the regex layer and hard rules still apply (same as the engine's --offline)."""
    return '{"intent_match": true, "injection_detected": false, "risk_reason": "AI check skipped (offline mode)."}'


def _unavailable_llm(reason: str) -> LLMClient:
    async def llm(system: str, user: str) -> str:
        raise RuntimeError(f"LLM unavailable: {reason}")
    return llm


def _with_timeout(llm: LLMClient, seconds: float) -> LLMClient:
    async def call(system: str, user: str) -> str:
        return await asyncio.wait_for(llm(system, user), timeout=seconds)
    return call


def build_llm(settings: Settings) -> Tuple[LLMClient, str]:
    if settings.offline:
        return _offline_llm, "offline (heuristics + rules only)"
    try:
        return _with_timeout(create_llm_client(), settings.llm_timeout), "ready"
    except Exception as exc:  # fail closed: every purchase will be blocked until the key is fixed
        logger.warning("AI safety client unavailable, purchases will be blocked: %s", exc)
        return _unavailable_llm(str(exc)), f"unavailable ({exc})"


def build_gateway(settings: Settings) -> PaymentGateway:
    if settings.paypal_mode == "sandbox":
        return PayPalSandbox(settings.paypal_client_id or "", settings.paypal_client_secret or "",
                             settings.paypal_base_url)
    return MockPayPal()


def create_app(settings: Optional[Settings] = None, *, llm: Optional[LLMClient] = None,
               gateway: Optional[PaymentGateway] = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        store = Store(settings.db_path)
        if settings.seed_demo_data:
            store.seed_if_empty(EVAL_SETTINGS, EVAL_MERCHANTS)
        else:
            store.seed_if_empty(EVAL_SETTINGS, [])
        if llm is not None:
            client, llm_status = llm, "ready"
        else:
            client, llm_status = build_llm(settings)
        pay = gateway or build_gateway(settings)
        app.state.settings = settings
        app.state.llm_status = llm_status
        app.state.service = AgentGuardService(store, pay, client, settings.currency)
        logger.info("AgentGuard API ready (llm=%s, paypal=%s, db=%s)", llm_status, pay.mode, settings.db_path)
        try:
            yield
        finally:
            await pay.aclose()
            store.close()

    app = FastAPI(
        title="AgentGuard API",
        version="1.0.0",
        description="Guardrail middleware for AI agent checkout: AI proposes, rules decide, users stay in control.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(ServiceError)
    async def service_error_handler(request: Request, exc: ServiceError) -> JSONResponse:
        body = {"detail": exc.message}
        if exc.transaction_id:
            body["transaction_id"] = exc.transaction_id
        return JSONResponse(status_code=exc.status_code, content=body)

    app.include_router(public, prefix="/api")
    app.include_router(router, prefix="/api")

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {"name": "AgentGuard API", "docs": "/docs", "health": "/api/health"}

    return app


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
app = create_app()
