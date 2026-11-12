"""
Loads the AgentGuard AI engine (the `agentguard_ai` package) without modifying it.

The engine lives at the repository root and uses relative imports, so it must be imported
as a package. The root folder is not named `agentguard_ai`, so we register it under that
name here. Set AGENTGUARD_AI_PATH to point at a different checkout of the engine.
"""
import importlib.util
import os
import sys
from pathlib import Path

PACKAGE = "agentguard_ai"
REPO_ROOT = Path(__file__).resolve().parents[3]


def _load_engine() -> None:
    if PACKAGE in sys.modules:
        return
    path = Path(os.getenv("AGENTGUARD_AI_PATH") or REPO_ROOT).resolve()
    init = path / "__init__.py"
    if not init.is_file():
        try:  # maybe it is installed / importable normally
            importlib.import_module(PACKAGE)
            return
        except ImportError as exc:
            raise ImportError(f"AgentGuard AI engine not found at {path} (set AGENTGUARD_AI_PATH)") from exc
    spec = importlib.util.spec_from_file_location(PACKAGE, init, submodule_search_locations=[str(path)])
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load AgentGuard AI engine from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[PACKAGE] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(PACKAGE, None)
        raise


_load_engine()

from agentguard_ai import (  # noqa: E402
    LLMClient,
    build_receipt,
    create_llm_client,
    decide,
    evaluate_purchase,
    run_rules,
    run_safety_check,
)
from agentguard_ai.eval_cases import EVAL_MERCHANTS, EVAL_SETTINGS  # noqa: E402
from agentguard_ai.schemas import (  # noqa: E402
    Decision,
    Merchant,
    PurchaseRequest,
    PurchaseResponse,
    Receipt,
    RuleResult,
    RuleSettings,
    SafetyResult,
)

__all__ = [
    "LLMClient", "build_receipt", "create_llm_client", "decide", "evaluate_purchase", "run_rules",
    "run_safety_check", "EVAL_MERCHANTS", "EVAL_SETTINGS", "Decision", "Merchant", "PurchaseRequest",
    "PurchaseResponse", "Receipt", "RuleResult", "RuleSettings", "SafetyResult",
]
