"""Run all Member 3 demo scenarios from the repository root."""
import json
from packages.agent import run_demo

if __name__ == "__main__":
    for scenario in ("safe", "injection", "over-budget", "low-rating"):
        print(f"\n=== {scenario.upper()} ===")
        print(json.dumps(run_demo(scenario), indent=2))
