"""
Business logic: AI engine -> decision -> PayPal -> audit ledger.

Flow for POST /api/purchase (mirrors agentguard_ai.evaluate_purchase):
  1. AI safety check (LLM + heuristics). Runs outside the lock: it is slow and stateless.
  2. Under a lock: load current rules + merchant, run hard rules, decide, build receipt,
     create the PayPal order and reserve budget. The lock stops two concurrent purchases
     from both passing the budget check and overspending.
Only "allowed" and "held" ever reach PayPal. "blocked" never moves money.
"""
import asyncio
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from .engine import (
    LLMClient,
    Merchant,
    PurchaseRequest,
    RuleSettings,
    build_receipt,
    decide,
    evaluate_purchase,
    run_rules,
    run_safety_check,
)
from .models import AWAITING_CAPTURE, DaySpend, EvaluationOut, RulesUpdate, StatsOut, TransactionRecord
from .paypal import PayerActionRequired, PaymentError, PaymentGateway
from .store import Store

logger = logging.getLogger("agentguard_api")

MAX_STORED_PAGE_TEXT = 20_000


class ServiceError(Exception):
    def __init__(self, status_code: int, message: str, transaction_id: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.transaction_id = transaction_id


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_ids() -> tuple:
    return f"AG-{uuid.uuid4().hex[:12].upper()}", f"rcpt_{secrets.token_hex(5).upper()}"


class AgentGuardService:
    def __init__(self, store: Store, gateway: PaymentGateway, llm: LLMClient, currency: str = "USD"):
        self.store = store
        self.gateway = gateway
        self.llm = llm
        self.currency = currency
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------ rules & merchants
    def rules(self) -> RuleSettings:
        rules = self.store.get_rules()
        if rules is None:
            raise ServiceError(503, "Rule settings are not configured yet.")
        return rules

    async def update_rules(self, update: RulesUpdate) -> RuleSettings:
        async with self._lock:
            current = self.rules()
            categories = list(dict.fromkeys(c.strip() for c in update.allowed_categories if c.strip()))
            rules = RuleSettings(**update.model_dump(exclude={"allowed_categories"}),
                                 allowed_categories=categories, spent_so_far=current.spent_so_far)
            self.store.save_rules(rules)
            return rules

    async def reset_spend(self) -> RuleSettings:
        async with self._lock:
            rules = self.rules().model_copy(update={"spent_so_far": 0})
            self.store.save_rules(rules)
            return rules

    def _add_spend(self, amount: float) -> None:
        rules = self.rules()
        self.store.save_rules(rules.model_copy(update={"spent_so_far": round(rules.spent_so_far + amount, 2)}))

    # ------------------------------------------------------------------ evaluation
    async def evaluate(self, req: PurchaseRequest) -> EvaluationOut:
        """Dry run: same decision pipeline, but no PayPal call and nothing is recorded."""
        out = await evaluate_purchase(req, self.rules(), self.store.get_merchant(req.merchant), self.llm)
        return EvaluationOut(decision=out.decision, reason=out.reason, safety=out.safety, rules=out.rules.results,
                             needs_approval=out.rules.needs_approval, receipt=out.receipt)

    async def purchase(self, req: PurchaseRequest, agent: str) -> TransactionRecord:
        safety = await run_safety_check(req, self.llm)
        async with self._lock:
            settings = self.rules()
            merchant: Optional[Merchant] = self.store.get_merchant(req.merchant)
            rules = run_rules(req, settings, merchant)
            decision = decide(safety.intent_match and not safety.injection_detected, rules)
            receipt = build_receipt(decision, req, settings, safety, rules)

            tx_id, receipt_id = _new_ids()
            record = TransactionRecord(
                id=tx_id, receipt_id=receipt_id, created_at=receipt.created_at, agent=agent, task=req.task,
                item=req.item, price=req.price, currency=self.currency, merchant=req.merchant,
                category=req.category, page_text=req.page_text[:MAX_STORED_PAGE_TEXT], decision=decision,
                reason=receipt.summary, receipt=receipt, safety=safety,
                approval_status="pending" if decision == "held" else None,
            )

            if decision != "blocked":
                intent = "CAPTURE" if decision == "allowed" else "AUTHORIZE"
                record.paypal_intent = intent
                try:
                    order = await self.gateway.create_order(
                        reference_id=tx_id, description=f"{req.item} ({req.merchant})"[:127],
                        amount=req.price, currency=self.currency, intent=intent,
                    )
                except PaymentError as exc:
                    logger.error("PayPal order creation failed for %s: %s", tx_id, exc)
                    record.payment_status = "FAILED"
                    record.payment_error = str(exc)
                    record.approval_status = None
                    record.reason = f"AgentGuard allowed this purchase, but PayPal could not create the order ({exc}). No money moved."
                else:
                    record.paypal_order_id = order.order_id
                    record.payment_status = order.status
                    record.approve_url = order.approve_url
                    record.authorization_id = order.authorization_id
                    record.capture_id = order.capture_id
                    if decision == "allowed":
                        self._add_spend(req.price)

            self.store.insert_transaction(record)

        if record.payment_status == "FAILED":
            raise ServiceError(502, record.reason, transaction_id=record.id)
        return record

    # ------------------------------------------------------------------ human approval
    def _get(self, tx_id: str) -> TransactionRecord:
        record = self.store.get_transaction(tx_id)
        if record is None:
            raise ServiceError(404, f'Transaction "{tx_id}" was not found.')
        return record

    def _pending(self, tx_id: str) -> TransactionRecord:
        record = self._get(tx_id)
        if record.decision != "held" or record.approval_status != "pending":
            raise ServiceError(409, f'Transaction "{tx_id}" is not waiting for approval.')
        return record

    async def approve(self, tx_id: str, note: Optional[str] = None) -> TransactionRecord:
        async with self._lock:
            record = self._pending(tx_id)
            rules = self.rules()
            remaining = rules.total_budget - rules.spent_so_far
            if record.price > remaining + 1e-9:
                raise ServiceError(409, f"Only ${max(remaining, 0):.2f} is left in the total budget; "
                                        f"this order costs ${record.price:.2f}. Raise the budget or reject it.")
            try:
                result = await self.gateway.settle(record.paypal_order_id or "", record.paypal_intent or "AUTHORIZE",
                                                   request_key=record.id, authorization_id=record.authorization_id)
            except PayerActionRequired as exc:
                record.payment_status = "PAYER_ACTION_REQUIRED"
                record.payment_error = str(exc)
            except PaymentError as exc:
                record.authorization_id = exc.authorization_id or record.authorization_id
                record.payment_error = str(exc)
                self.store.update_transaction(record)
                raise ServiceError(502, f"PayPal could not complete the payment: {exc}", transaction_id=record.id)
            else:
                record.payment_status = result.status
                record.capture_id = result.capture_id
                record.authorization_id = result.authorization_id or record.authorization_id
                record.payment_error = None

            record.approval_status = "approved"
            record.decided_at = _now()
            record.decision_note = note
            self._add_spend(record.price)
            self.store.update_transaction(record)
            return record

    async def reject(self, tx_id: str, note: Optional[str] = None) -> TransactionRecord:
        async with self._lock:
            record = self._pending(tx_id)
            try:
                record.payment_status = await self.gateway.cancel(
                    record.paypal_order_id or "", request_key=record.id, authorization_id=record.authorization_id)
            except PaymentError as exc:  # the human said no: never charge, even if voiding failed
                logger.error("Voiding PayPal authorization for %s failed: %s", record.id, exc)
                record.payment_status = "VOID_FAILED"
                record.payment_error = str(exc)
            record.approval_status = "rejected"
            record.decided_at = _now()
            record.decision_note = note
            self.store.update_transaction(record)
            return record

    async def capture(self, tx_id: str) -> TransactionRecord:
        """Complete payment for an approved order once the PayPal payer has approved it (Sandbox)."""
        async with self._lock:
            record = self._get(tx_id)
            if record.display_status != "Approved" or record.payment_status not in AWAITING_CAPTURE:
                raise ServiceError(409, f'Transaction "{tx_id}" has no payment waiting to be captured.')
            try:
                result = await self.gateway.settle(record.paypal_order_id or "", record.paypal_intent or "CAPTURE",
                                                   request_key=record.id, authorization_id=record.authorization_id)
            except PayerActionRequired:
                raise ServiceError(409, "The PayPal payer has not approved this order yet. "
                                        f"Open the approve link first: {record.approve_url or 'n/a'}",
                                   transaction_id=record.id)
            except PaymentError as exc:
                record.authorization_id = exc.authorization_id or record.authorization_id
                record.payment_error = str(exc)
                self.store.update_transaction(record)
                raise ServiceError(502, f"PayPal could not complete the payment: {exc}", transaction_id=record.id)
            record.payment_status = result.status
            record.capture_id = result.capture_id
            record.authorization_id = result.authorization_id or record.authorization_id
            record.payment_error = None
            self.store.update_transaction(record)
            return record

    # ------------------------------------------------------------------ ledger & stats
    def transactions(self, status: Optional[str] = None, search: Optional[str] = None) -> List[TransactionRecord]:
        records = self.store.list_transactions(search)
        if status:
            records = [r for r in records if r.display_status.lower() == status.lower()]
        return records

    def transaction(self, tx_id: str) -> TransactionRecord:
        return self._get(tx_id)

    def receipt(self, receipt_id: str) -> TransactionRecord:
        record = self.store.find_by_receipt(receipt_id)
        if record is None:
            raise ServiceError(404, f'Receipt "{receipt_id}" was not found.')
        return record

    def stats(self) -> StatsOut:
        rules = self.rules()
        records = self.store.list_transactions()
        counts = {"approved": 0, "held": 0, "blocked": 0}
        blocked_amount = 0.0
        today = datetime.now(timezone.utc).date()
        days = [today - timedelta(days=i) for i in range(6, -1, -1)]
        by_day = {d: 0.0 for d in days}
        for r in records:
            status = r.display_status
            counts[status.lower()] += 1
            if status == "Blocked":
                blocked_amount += r.price
            if r.counts_toward_spend:
                spent_on = datetime.fromisoformat(r.decided_at or r.created_at).astimezone(timezone.utc).date()
                if spent_on in by_day:
                    by_day[spent_on] += r.price
        return StatsOut(
            total_budget=rules.total_budget,
            spent_so_far=rules.spent_so_far,
            remaining_budget=round(max(rules.total_budget - rules.spent_so_far, 0), 2),
            approval_limit=rules.approval_limit,
            max_per_order=rules.max_per_order,
            counts=counts,
            pending_approvals=counts["held"],
            blocked_amount=round(blocked_amount, 2),
            spending_by_day=[DaySpend(day=d.strftime("%a"), date=d.isoformat(), amount=round(by_day[d], 2))
                             for d in days],
        )
