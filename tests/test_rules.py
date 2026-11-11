import pytest

from agentguard_ai import decide, run_rules
from agentguard_ai.schemas import Merchant, PurchaseRequest, RuleSettings

settings = RuleSettings(max_per_order=150, total_budget=500, spent_so_far=0,
                        allowed_categories=["Electronics", "books"], min_merchant_rating=4.0,
                        require_return_policy=True, approval_limit=100)
good = Merchant(name="TechMart", rating=4.6, has_return_policy=True)


def req(**over) -> PurchaseRequest:
    base = dict(task="t", item="i", price=20, merchant="TechMart", category="electronics", page_text="")
    return PurchaseRequest(**{**base, **over})


def test_passes_normal_order():
    r = run_rules(req(), settings, good)
    assert r.passed and not r.needs_approval


def test_blocks_over_per_order_limit():
    assert not run_rules(req(price=151), settings, good).passed


def test_blocks_when_remaining_budget_too_small():
    assert not run_rules(req(price=40), settings.model_copy(update={"spent_so_far": 480}), good).passed


def test_category_case_insensitive():
    assert run_rules(req(category="ELECTRONICS"), settings, good).passed


def test_blocks_disallowed_category():
    assert not run_rules(req(category="gift cards"), settings, good).passed


def test_blocks_empty_allowed_categories():
    assert not run_rules(req(), settings.model_copy(update={"allowed_categories": []}), good).passed


def test_blocks_low_rating_but_allows_exact_minimum():
    assert not run_rules(req(), settings, good.model_copy(update={"rating": 3.9})).passed
    assert run_rules(req(), settings, good.model_copy(update={"rating": 4.0})).passed


def test_return_policy_only_when_required():
    m = good.model_copy(update={"has_return_policy": False})
    assert not run_rules(req(), settings, m).passed
    assert run_rules(req(), settings.model_copy(update={"require_return_policy": False}), m).passed


def test_blocks_unknown_merchant():
    assert not run_rules(req(), settings, None).passed


def test_needs_approval_only_strictly_above_limit():
    assert not run_rules(req(price=100), settings, good).needs_approval
    assert run_rules(req(price=100.01), settings, good).needs_approval


def test_decide():
    ok = run_rules(req(), settings, good)
    held = run_rules(req(price=120), settings, good)
    bad = run_rules(req(price=999), settings, good)
    assert decide(True, ok) == "allowed"
    assert decide(True, held) == "held"
    assert decide(True, bad) == "blocked"
    assert decide(False, ok) == "blocked"  # safety failure blocks even if rules pass


def test_negative_price_rejected_by_schema():
    with pytest.raises(Exception):
        req(price=-5)
