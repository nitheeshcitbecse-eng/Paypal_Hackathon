"""The frozen request/response contract. JSON shapes are identical to the original TypeScript version."""
from typing import Optional
from typing import Literal

from pydantic import BaseModel, Field

Decision = Literal["allowed", "blocked", "held"]


class PurchaseRequest(BaseModel):
    """What the shopping agent sends to AgentGuard."""
    task: str = Field(min_length=1)       # what the user originally asked for
    item: str = Field(min_length=1)       # what the agent wants to buy
    price: float = Field(gt=0)            # USD
    merchant: str = Field(min_length=1)
    category: str = Field(min_length=1)
    page_text: str = ""                   # raw product page text (UNTRUSTED)


class RuleSettings(BaseModel):
    """User-configured rules (dashboard sliders and toggles)."""
    max_per_order: float = Field(gt=0)
    total_budget: float = Field(gt=0)
    spent_so_far: float = Field(default=0, ge=0)
    allowed_categories: list[str]
    min_merchant_rating: float = Field(ge=0, le=5)
    require_return_policy: bool
    approval_limit: float = Field(ge=0)   # above this -> HOLD for approval


class Merchant(BaseModel):
    """One row of the simulated merchant registry."""
    name: str
    rating: float = Field(ge=0, le=5)
    has_return_policy: bool


class SafetyResult(BaseModel):
    """Output of the AI safety check."""
    intent_match: bool
    injection_detected: bool
    risk_reason: str


class RuleResult(BaseModel):
    rule: str
    passed: bool
    reason: str


class Check(BaseModel):
    name: str
    passed: bool
    detail: str


class Receipt(BaseModel):
    """Plain-language decision receipt, stored against the PayPal order ID."""
    decision: Decision
    headline: str
    summary: str
    checks: list[Check]
    created_at: str


class PurchaseResponse(BaseModel):
    """What AgentGuard's API returns to the agent / dashboard."""
    decision: Decision
    reason: str
    paypal_order_id: Optional[str] = None
    receipt: Receipt
