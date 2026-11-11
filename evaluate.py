from typing import Optional
from pydantic import BaseModel, ConfigDict

from .llm import LLMClient
from .receipt import build_receipt
from .rules import RulesOutcome, decide, run_rules
from .safety import run_safety_check
from .schemas import Decision, Merchant, PurchaseRequest, Receipt, RuleSettings, SafetyResult


class Evaluation(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    decision: Decision
    reason: str            # one-liner, same as receipt.summary
    safety: SafetyResult
    rules: RulesOutcome
    receipt: Receipt


async def evaluate_purchase(request: PurchaseRequest, settings: RuleSettings,
                            merchant: Optional[Merchant], llm: LLMClient) -> Evaluation:
    """
    THE entry point the API calls (before any PayPal call):
    AI safety check -> hard rules -> allow / hold / block -> receipt.
    Only "allowed" and "held" should ever reach PayPal.
    """
    safety = await run_safety_check(request, llm)
    rules = run_rules(request, settings, merchant)
    decision = decide(safety.intent_match and not safety.injection_detected, rules)
    receipt = build_receipt(decision, request, settings, safety, rules)
    return Evaluation(decision=decision, reason=receipt.summary, safety=safety, rules=rules, receipt=receipt)
