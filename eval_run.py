"""
Run from the project folder:
  python -m agentguard_ai.eval_run                    # full pipeline with the real AI
  python -m agentguard_ai.eval_run --heuristics-only  # regex + rules only (no AI, no API key)
"""
import asyncio
import os
import sys

from dotenv import find_dotenv, load_dotenv

from .eval_cases import EVAL_CASES, EVAL_MERCHANTS, EVAL_SETTINGS
from .evaluate import evaluate_purchase
from .llm import create_llm_client

load_dotenv(find_dotenv(usecwd=True))
HEURISTICS_ONLY = "--heuristics-only" in sys.argv
# Groq's free tier allows ~12,000 tokens/minute, so pause between cases to avoid rate-limit errors.
# Override with EVAL_DELAY (seconds) in .env if you want.
DELAY = 0.0 if HEURISTICS_ONLY else float(os.getenv("EVAL_DELAY", "6" if (os.getenv("LLM_PROVIDER") or "").lower() == "groq" else "0"))


async def benign_llm(system: str, user: str) -> str:
    """Offline baseline: pretend the AI approves everything, so only regex + rules are tested."""
    return '{"intent_match": true, "injection_detected": false, "risk_reason": "offline baseline"}'


def pct(a: int, b: int) -> str:
    return f"{round(100 * a / b)}%" if b else "n/a"


async def main() -> int:
    if HEURISTICS_ONLY:
        llm = benign_llm
        print("Mode: regex + rules only (no AI)\n")
    else:
        try:
            llm = create_llm_client()
        except Exception as e:  # missing key or SDK
            print(f"Cannot start the AI client: {e}")
            print("Fix: create a file named .env in this folder with:")
            print("  LLM_PROVIDER=groq")
            print("  LLM_API_KEY=your-key-here")
            return 1
        print("Mode: full pipeline (AI + regex + rules)\n")

    correct, llm_total, llm_correct, failures = 0, 0, 0, []
    for c in EVAL_CASES:
        settings = EVAL_SETTINGS.model_copy(update=c.settings)
        merchant = next((m for m in EVAL_MERCHANTS if m.name == c.request.merchant), None)
        out = await evaluate_purchase(c.request, settings, merchant, llm)
        ok = out.decision == c.expected
        correct += ok
        if c.needs_llm:
            llm_total += 1
            llm_correct += ok
        if not ok:
            failures.append(f"{c.id} {c.label}: expected {c.expected}, got {out.decision} ({out.safety.risk_reason})")
        print(f"{'PASS' if ok else 'FAIL'}  {c.id:<3} {c.label:<42} expected={c.expected:<7} got={out.decision}", flush=True)
        if DELAY:
            await asyncio.sleep(DELAY)

    print(f"\nOverall:                 {correct}/{len(EVAL_CASES)} ({pct(correct, len(EVAL_CASES))})")
    print(f"AI-only cases (subtle):  {llm_correct}/{llm_total} ({pct(llm_correct, llm_total)})")
    if failures:
        print("\nFailures:\n" + "\n".join(f"  - {f}" for f in failures))
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
