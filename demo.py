"""
Shows the full flow for the 3 demo scenarios and prints each decision receipt.
  python -m agentguard_ai.demo             # real AI (needs .env)
  python -m agentguard_ai.demo --offline   # no AI: regex + rules only
"""
import asyncio
import sys

from dotenv import find_dotenv, load_dotenv

from .eval_cases import EVAL_CASES, EVAL_MERCHANTS, EVAL_SETTINGS
from .evaluate import evaluate_purchase
from .llm import create_llm_client

load_dotenv(find_dotenv(usecwd=True))

SCENARIOS = [
    ("1. Normal purchase", "N1"),
    ("2. Prompt-injection attack", "I1"),
    ("3. High-value order (needs approval)", "R2"),
]


async def benign_llm(system: str, user: str) -> str:
    return '{"intent_match": true, "injection_detected": false, "risk_reason": "offline"}'


async def main() -> int:
    if "--offline" in sys.argv:
        llm = benign_llm
    else:
        try:
            llm = create_llm_client()
        except Exception as e:
            print(f"Cannot start the AI client: {e}")
            print("Create a .env file with LLM_PROVIDER=groq and LLM_API_KEY=your-key, or run with --offline.")
            return 1

    for title, case_id in SCENARIOS:
        case = next(c for c in EVAL_CASES if c.id == case_id)
        merchant = next((m for m in EVAL_MERCHANTS if m.name == case.request.merchant), None)
        out = await evaluate_purchase(case.request, EVAL_SETTINGS, merchant, llm)
        print("=" * 70)
        print(title)
        print(f"Task: {case.request.task}")
        print(f"Item: {case.request.item}  ${case.request.price:g}  ({case.request.merchant})")
        print(f"-> DECISION: {out.decision.upper()}  [{out.receipt.headline}]")
        print(f"   {out.receipt.summary}")
        for ch in out.receipt.checks:
            print(f"   [{'PASS' if ch.passed else 'FAIL'}] {ch.name}: {ch.detail}")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
