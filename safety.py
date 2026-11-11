from typing import Optional
import json
import logging
import re


from .heuristics import scan_for_injection
from .llm import LLMClient
from .prompt import SAFETY_SYSTEM_PROMPT, build_user_prompt
from .schemas import PurchaseRequest, SafetyResult

logger = logging.getLogger("agentguard_ai")

SAFETY_UNAVAILABLE_REASON = (
    "The AI safety check could not be completed, so the purchase was stopped as a precaution."
)
RETRY_NOTE = "\n\nYour previous reply was not valid. Reply with ONLY the JSON object described."


def extract_json(text: str):
    """Pull the first JSON object out of a model reply, tolerating ```json fences and chatter."""
    cleaned = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object found")
    return json.loads(cleaned[start : end + 1])


async def run_safety_check(req: PurchaseRequest, llm: LLMClient) -> SafetyResult:
    flags = scan_for_injection(req.page_text)
    user = build_user_prompt(req)

    parsed: Optional[SafetyResult] = None
    for attempt in range(2):
        try:
            raw = await llm(SAFETY_SYSTEM_PROMPT, user if attempt == 0 else user + RETRY_NOTE)
            parsed = SafetyResult.model_validate(extract_json(raw))
            break
        except Exception as e:  # malformed output OR network error: both fail closed
            logger.warning("AI safety check attempt %d failed: %s: %s", attempt + 1, type(e).__name__, e)
            parsed = None

    # Fail closed: if the AI check can't give a valid answer, we do not let money move.
    if parsed is None:
        return SafetyResult(
            intent_match=False,
            injection_detected=len(flags) > 0,
            risk_reason=SAFETY_UNAVAILABLE_REASON,
        )

    # Heuristics can only add suspicion.
    if flags:
        extra = f" {parsed.risk_reason}" if parsed.injection_detected else ""
        return SafetyResult(
            intent_match=parsed.intent_match,
            injection_detected=True,
            risk_reason=f"Page text {'; '.join(flags)}.{extra}",
        )
    return parsed
