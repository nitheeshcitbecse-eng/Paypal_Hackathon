"""API models. Engine models (PurchaseRequest, RuleSettings, Receipt, ...) are reused as-is."""
import re
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from .engine import Decision, PurchaseRequest, PurchaseResponse, Receipt, RuleResult, SafetyResult

ApprovalStatus = Literal["pending", "approved", "rejected"]
DisplayStatus = Literal["Approved", "Held", "Blocked"]

# Payment states in which the purchase is approved but money has not been captured yet.
AWAITING_CAPTURE = {"CREATED", "APPROVED", "PAYER_ACTION_REQUIRED", "AUTHORIZED"}


# ----------------------------------------------------------------------------- requests
class PurchaseIn(PurchaseRequest):
    """The engine's PurchaseRequest, plus which agent sent it."""
    page_text: str = Field(default="", max_length=50_000)
    agent: str = Field(default="ShoppingAgent", min_length=1, max_length=80)

    def to_request(self) -> PurchaseRequest:
        return PurchaseRequest(**self.model_dump(exclude={"agent"}))


class RulesUpdate(BaseModel):
    """Editable rule settings. `spent_so_far` is owned by the server and ignored if sent."""
    max_per_order: float = Field(gt=0)
    total_budget: float = Field(gt=0)
    allowed_categories: List[str]
    min_merchant_rating: float = Field(ge=0, le=5)
    require_return_policy: bool
    approval_limit: float = Field(ge=0)


class MerchantIn(BaseModel):
    rating: float = Field(ge=0, le=5)
    has_return_policy: bool


class DecisionIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)


# ----------------------------------------------------------------------------- responses
class PurchaseOut(PurchaseResponse):
    """The engine's frozen PurchaseResponse, plus backend bookkeeping fields."""
    transaction_id: str
    payment_status: Optional[str] = None
    approve_url: Optional[str] = None


class EvaluationOut(BaseModel):
    decision: Decision
    reason: str
    safety: SafetyResult
    rules: List[RuleResult]
    needs_approval: bool
    receipt: Receipt


class DaySpend(BaseModel):
    day: str        # "Mon"
    date: str       # "2026-11-12"
    amount: float


class StatsOut(BaseModel):
    total_budget: float
    spent_so_far: float
    remaining_budget: float
    approval_limit: float
    max_per_order: float
    counts: Dict[str, int]
    pending_approvals: int
    blocked_amount: float
    spending_by_day: List[DaySpend]


class HealthOut(BaseModel):
    status: str
    llm: str
    paypal_mode: str


# ----------------------------------------------------------------------------- ledger
class TransactionRecord(BaseModel):
    """One row of the audit ledger (internal, snake_case)."""
    id: str
    receipt_id: str
    created_at: str
    agent: str
    task: str
    item: str
    price: float
    currency: str
    merchant: str
    category: str
    page_text: str = ""
    decision: Decision
    reason: str
    receipt: Receipt
    safety: SafetyResult
    approval_status: Optional[ApprovalStatus] = None
    decided_at: Optional[str] = None
    decision_note: Optional[str] = None
    paypal_order_id: Optional[str] = None
    paypal_intent: Optional[str] = None
    payment_status: Optional[str] = None
    approve_url: Optional[str] = None
    authorization_id: Optional[str] = None
    capture_id: Optional[str] = None
    payment_error: Optional[str] = None

    @property
    def display_status(self) -> DisplayStatus:
        if self.payment_status == "FAILED":
            return "Blocked"
        if self.decision == "allowed" or self.approval_status == "approved":
            return "Approved"
        if self.decision == "held" and self.approval_status == "pending":
            return "Held"
        return "Blocked"

    @property
    def counts_toward_spend(self) -> bool:
        return self.display_status == "Approved"


def merchant_initials(name: str) -> str:
    words = [w for w in re.split(r"[\s\-_]+", name.strip()) if w]
    if len(words) == 1:  # "TechMart" -> ["Tech", "Mart"]
        words = re.findall(r"[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])", words[0]) or words
    return "".join(w[0] for w in words[:2]).upper() or "?"


class TransactionOut(BaseModel):
    """Ledger row for the dashboard. Field names match apps/web/mocks/data.ts (camelCase)."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str
    merchant: str
    merchant_initials: str
    product: str
    agent: str
    amount: float
    currency: str
    date: str                      # ISO-8601 UTC
    status: DisplayStatus
    category: str
    reason: str
    receipt_id: str
    task: str
    decision: Decision             # raw engine decision
    approval_status: Optional[ApprovalStatus] = None
    decided_at: Optional[str] = None
    decision_note: Optional[str] = None
    paypal_order_id: Optional[str] = None
    payment_status: Optional[str] = None
    approve_url: Optional[str] = None
    payment_error: Optional[str] = None
    safety: SafetyResult
    receipt: Receipt

    @classmethod
    def from_record(cls, r: TransactionRecord) -> "TransactionOut":
        return cls(
            id=r.id, merchant=r.merchant, merchant_initials=merchant_initials(r.merchant), product=r.item,
            agent=r.agent, amount=r.price, currency=r.currency, date=r.created_at, status=r.display_status,
            category=r.category, reason=r.reason, receipt_id=r.receipt_id, task=r.task, decision=r.decision,
            approval_status=r.approval_status, decided_at=r.decided_at, decision_note=r.decision_note,
            paypal_order_id=r.paypal_order_id, payment_status=r.payment_status, approve_url=r.approve_url,
            payment_error=r.payment_error, safety=r.safety, receipt=r.receipt,
        )
