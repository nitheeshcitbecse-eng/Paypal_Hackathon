"""
Cheap, offline first line of defence against obvious prompt injection.
The LLM adds judgement on top; this layer can only ADD suspicion, never remove it.
"""
import re

_F = re.IGNORECASE
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("tells the agent to ignore its instructions",
     re.compile(r"\b(ignore|disregard|forget|override)\b[^.\n]{0,30}\b(previous|prior|above|earlier|your|all|the)\b[^.\n]{0,30}\b(instructions?|rules?|prompts?|limits?|guard|guardrails?)\b", _F)),
    ("tries to bypass approval or limits",
     re.compile(r"\b(bypass|skip|circumvent|disable)\b[^.\n]{0,30}\b(approval|guard|check|limit|budget|safety|verification)\b", _F)),
    ("claims the user already approved",
     re.compile(r"\b(user|owner|customer)\b[^.\n]{0,20}\b(has\s+)?(already\s+)?(pre-?approved|authori[sz]ed|consented)\b", _F)),
    ("tells the agent to hide actions from the user",
     re.compile(r"\bdo not (mention|tell|inform|reveal|show)\b[^.\n]{0,40}\b(user|owner|customer|summary)\b", _F)),
    ("tells the agent to buy something else",
     re.compile(r"\b(buy|purchase|order|checkout|send)\b[^.\n]{0,40}\bgift ?cards?\b", _F)),
    ("tries to reassign the agent's role",
     re.compile(r"\byou are now\b|\bnew instructions?\s*:|\bsystem\s*:", _F)),
    ("addresses AI agents directly",
     re.compile(r"\b(attention|note to|message for|instructions? for)\b[^.\n]{0,15}\b(ai|assistants?|agents?|bots?|llms?)\b", _F)),
]


def scan_for_injection(text: str) -> list[str]:
    return [label for label, pattern in _PATTERNS if pattern.search(text)]
