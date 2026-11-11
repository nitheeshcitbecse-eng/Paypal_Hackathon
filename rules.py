"""Hard rules: pure code, no AI, no guessing. ALL must pass."""
from typing import Optional
from dataclasses import dataclass

from .schemas import Decision, Merchant, PurchaseRequest, RuleResult, RuleSettings


def usd(n: float) -> str:
    return f"${n:.2f}"


def check_budget(req: PurchaseRequest, s: RuleSettings) -> RuleResult:
    rule = "Budget"
    if req.price > s.max_per_order:
        return RuleResult(rule=rule, passed=False,
                          reason=f"Price {usd(req.price)} is above the per-order limit of {usd(s.max_per_order)}.")
    remaining = s.total_budget - s.spent_so_far
    if req.price > remaining:
        return RuleResult(rule=rule, passed=False,
                          reason=f"Only {usd(max(remaining, 0))} is left in the total budget; this order costs {usd(req.price)}.")
    return RuleResult(rule=rule, passed=True,
                      reason=f"{usd(req.price)} is within the per-order limit ({usd(s.max_per_order)}) and remaining budget ({usd(remaining)}).")


def check_category(req: PurchaseRequest, s: RuleSettings) -> RuleResult:
    rule = "Category"
    if not s.allowed_categories:
        return RuleResult(rule=rule, passed=False, reason="No categories are allowed in the current settings.")
    ok = any(c.strip().lower() == req.category.strip().lower() for c in s.allowed_categories)
    if ok:
        return RuleResult(rule=rule, passed=True, reason=f'Category "{req.category}" is allowed.')
    return RuleResult(rule=rule, passed=False,
                      reason=f'Category "{req.category}" is not on the allowed list ({", ".join(s.allowed_categories)}).')


def check_merchant_rating(merchant: Optional[Merchant], name: str, s: RuleSettings) -> RuleResult:
    rule = "Merchant rating"
    if merchant is None:
        return RuleResult(rule=rule, passed=False,
                          reason=f'Merchant "{name}" is not in the merchant registry, so it cannot be trusted.')
    if merchant.rating >= s.min_merchant_rating:
        return RuleResult(rule=rule, passed=True,
                          reason=f"{merchant.name} is rated {merchant.rating:g}, at or above the required {s.min_merchant_rating:g}.")
    return RuleResult(rule=rule, passed=False,
                      reason=f"{merchant.name} is rated {merchant.rating:g}, below the required {s.min_merchant_rating:g}.")


def check_return_policy(merchant: Optional[Merchant], name: str, s: RuleSettings) -> RuleResult:
    rule = "Return policy"
    if not s.require_return_policy:
        return RuleResult(rule=rule, passed=True, reason="A return policy is not required.")
    if merchant is None:
        return RuleResult(rule=rule, passed=False,
                          reason=f'Merchant "{name}" is not in the registry, so its return policy is unknown.')
    if merchant.has_return_policy:
        return RuleResult(rule=rule, passed=True, reason=f"{merchant.name} has a return policy.")
    return RuleResult(rule=rule, passed=False, reason=f"{merchant.name} has no return policy, which is required.")


def needs_approval(req: PurchaseRequest, s: RuleSettings) -> bool:
    """Orders strictly above the approval limit are authorized only and wait for a human."""
    return req.price > s.approval_limit


@dataclass
class RulesOutcome:
    passed: bool
    results: list[RuleResult]
    needs_approval: bool


def run_rules(req: PurchaseRequest, s: RuleSettings, merchant: Optional[Merchant]) -> RulesOutcome:
    results = [
        check_budget(req, s),
        check_category(req, s),
        check_merchant_rating(merchant, req.merchant, s),
        check_return_policy(merchant, req.merchant, s),
    ]
    return RulesOutcome(passed=all(r.passed for r in results), results=results,
                        needs_approval=needs_approval(req, s))


def decide(safety_passed: bool, rules: RulesOutcome) -> Decision:
    """Final gate: AI proposes, rules decide. Any failure blocks."""
    if not safety_passed or not rules.passed:
        return "blocked"
    return "held" if rules.needs_approval else "allowed"
