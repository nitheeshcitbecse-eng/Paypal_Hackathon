"""
Receipts are built from structured results, not written freely by an LLM,
so they always match what actually happened (no made-up reasoning).
"""
from typing import Optional
from datetime import datetime, timezone

from .rules import RulesOutcome, usd
from .safety import SAFETY_UNAVAILABLE_REASON
from .schemas import Check, Decision, PurchaseRequest, Receipt, RuleSettings, SafetyResult


def _end(text: str) -> str:
    """Make sure a sentence ends with punctuation before sentences are joined."""
    text = text.strip()
    return text if text[-1:] in ".!?" else text + "."


def build_receipt(decision: Decision, request: PurchaseRequest, settings: RuleSettings,
                  safety: SafetyResult, rules: RulesOutcome, now: Optional[datetime] = None) -> Receipt:
    r = request
    unavailable = safety.risk_reason == SAFETY_UNAVAILABLE_REASON
    checks = [
        Check(
            name="Matches what you asked for",
            passed=safety.intent_match,
            detail=(f'"{r.item}" fits the task "{r.task}".' if safety.intent_match
                    else (SAFETY_UNAVAILABLE_REASON if unavailable
                          else f'"{r.item}" does not fit the task "{r.task}". {safety.risk_reason}')),
        ),
        Check(
            name="Free of hidden instructions",
            passed=not safety.injection_detected,
            detail=(safety.risk_reason if safety.injection_detected
                    else "No instructions aimed at the AI agent were found on the page."),
        ),
        *[Check(name=x.rule, passed=x.passed, detail=x.reason) for x in rules.results],
    ]
    failed = [c for c in checks if not c.passed]
    what = f"{r.item} from {r.merchant} for {usd(r.price)}"

    if decision == "allowed":
        headline = "Approved"
        summary = f"{what} passed every safety and rule check, so the payment was completed."
    elif decision == "held":
        headline = "Held for your approval"
        summary = (f"{what} passed every check but is above your approval limit of {usd(settings.approval_limit)}. "
                   f"The amount is reserved on PayPal but not charged until you approve.")
    else:
        headline = "Blocked"
        summary = f"{what} was stopped: {' '.join(dict.fromkeys(_end(c.detail) for c in failed))} No money moved."

    ts = (now or datetime.now(timezone.utc)).isoformat()
    return Receipt(decision=decision, headline=headline, summary=summary, checks=checks, created_at=ts)
