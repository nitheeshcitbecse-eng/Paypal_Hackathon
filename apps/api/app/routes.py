"""HTTP routes. Everything is mounted under /api (see main.py)."""
import secrets
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status

from .engine import Merchant, RuleSettings
from .models import (
    DecisionIn,
    EvaluationOut,
    HealthOut,
    MerchantIn,
    PurchaseIn,
    PurchaseOut,
    RulesUpdate,
    StatsOut,
    TransactionOut,
)
from .service import AgentGuardService


def get_service(request: Request) -> AgentGuardService:
    return request.app.state.service


def require_api_key(request: Request, x_api_key: Optional[str] = Header(default=None)) -> None:
    expected = request.app.state.settings.api_key
    if expected and not (x_api_key and secrets.compare_digest(x_api_key, expected)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing or invalid X-API-Key header.")


public = APIRouter()
router = APIRouter(dependencies=[Depends(require_api_key)])


# ----------------------------------------------------------------------------- health
@public.get("/health", response_model=HealthOut, tags=["system"])
def health(request: Request) -> HealthOut:
    return HealthOut(status="ok", llm=request.app.state.llm_status, paypal_mode=request.app.state.service.gateway.mode)


# ----------------------------------------------------------------------------- purchases
@router.post("/purchase", response_model=PurchaseOut, tags=["purchases"],
             responses={502: {"description": "Allowed, but PayPal could not create the order"}})
async def purchase(body: PurchaseIn, svc: AgentGuardService = Depends(get_service)) -> PurchaseOut:
    """The shopping agent's checkout call: AI safety check + hard rules, then PayPal if allowed / held."""
    record = await svc.purchase(body.to_request(), body.agent)
    return PurchaseOut(decision=record.decision, reason=record.reason, paypal_order_id=record.paypal_order_id,
                       receipt=record.receipt, transaction_id=record.id, payment_status=record.payment_status,
                       approve_url=record.approve_url)


@router.post("/evaluate", response_model=EvaluationOut, tags=["purchases"])
async def evaluate(body: PurchaseIn, svc: AgentGuardService = Depends(get_service)) -> EvaluationOut:
    """Dry run of the decision pipeline (playground). No PayPal call, nothing recorded."""
    return await svc.evaluate(body.to_request())


# ----------------------------------------------------------------------------- rules
@router.get("/rules", response_model=RuleSettings, tags=["rules"])
def get_rules(svc: AgentGuardService = Depends(get_service)) -> RuleSettings:
    return svc.rules()


@router.put("/rules", response_model=RuleSettings, tags=["rules"])
async def update_rules(body: RulesUpdate, svc: AgentGuardService = Depends(get_service)) -> RuleSettings:
    return await svc.update_rules(body)


@router.post("/rules/reset-spend", response_model=RuleSettings, tags=["rules"])
async def reset_spend(svc: AgentGuardService = Depends(get_service)) -> RuleSettings:
    return await svc.reset_spend()


# ----------------------------------------------------------------------------- merchants
@router.get("/merchants", response_model=List[Merchant], tags=["merchants"])
def list_merchants(svc: AgentGuardService = Depends(get_service)) -> List[Merchant]:
    return svc.store.list_merchants()


@router.get("/merchants/{name}", response_model=Merchant, tags=["merchants"])
def get_merchant(name: str, svc: AgentGuardService = Depends(get_service)) -> Merchant:
    merchant = svc.store.get_merchant(name)
    if merchant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f'Merchant "{name}" is not in the registry.')
    return merchant


@router.put("/merchants/{name}", response_model=Merchant, tags=["merchants"])
def upsert_merchant(name: str, body: MerchantIn, svc: AgentGuardService = Depends(get_service)) -> Merchant:
    if not name.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Merchant name is required.")
    return svc.store.upsert_merchant(Merchant(name=name.strip(), **body.model_dump()))


@router.delete("/merchants/{name}", status_code=status.HTTP_204_NO_CONTENT, tags=["merchants"])
def delete_merchant(name: str, svc: AgentGuardService = Depends(get_service)) -> Response:
    if not svc.store.delete_merchant(name):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f'Merchant "{name}" is not in the registry.')
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ----------------------------------------------------------------------------- ledger
@router.get("/transactions", response_model=List[TransactionOut], tags=["audit"])
def list_transactions(
    status_filter: Optional[Literal["Approved", "Held", "Blocked"]] = Query(default=None, alias="status"),
    q: Optional[str] = Query(default=None, max_length=200),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    svc: AgentGuardService = Depends(get_service),
) -> List[TransactionOut]:
    records = svc.transactions(status_filter, q)[offset: offset + limit]
    return [TransactionOut.from_record(r) for r in records]


@router.get("/transactions/{tx_id}", response_model=TransactionOut, tags=["audit"])
def get_transaction(tx_id: str, svc: AgentGuardService = Depends(get_service)) -> TransactionOut:
    return TransactionOut.from_record(svc.transaction(tx_id))


@router.post("/transactions/{tx_id}/capture", response_model=TransactionOut, tags=["audit"])
async def capture_transaction(tx_id: str, svc: AgentGuardService = Depends(get_service)) -> TransactionOut:
    """Sandbox only: capture an approved order after the PayPal payer has approved it."""
    return TransactionOut.from_record(await svc.capture(tx_id))


@router.get("/receipts/{receipt_id}", response_model=TransactionOut, tags=["audit"])
def get_receipt(receipt_id: str, svc: AgentGuardService = Depends(get_service)) -> TransactionOut:
    return TransactionOut.from_record(svc.receipt(receipt_id))


@router.get("/stats", response_model=StatsOut, tags=["audit"])
def stats(svc: AgentGuardService = Depends(get_service)) -> StatsOut:
    return svc.stats()


# ----------------------------------------------------------------------------- approvals
@router.get("/approvals", response_model=List[TransactionOut], tags=["approvals"])
def list_approvals(svc: AgentGuardService = Depends(get_service)) -> List[TransactionOut]:
    """Held purchases waiting for a human decision, oldest first."""
    return [TransactionOut.from_record(r) for r in reversed(svc.transactions("Held"))]


@router.post("/approvals/{tx_id}/approve", response_model=TransactionOut, tags=["approvals"])
async def approve(tx_id: str, body: Optional[DecisionIn] = None,
                  svc: AgentGuardService = Depends(get_service)) -> TransactionOut:
    return TransactionOut.from_record(await svc.approve(tx_id, body.note if body else None))


@router.post("/approvals/{tx_id}/reject", response_model=TransactionOut, tags=["approvals"])
async def reject(tx_id: str, body: Optional[DecisionIn] = None,
                 svc: AgentGuardService = Depends(get_service)) -> TransactionOut:
    return TransactionOut.from_record(await svc.reject(tx_id, body.note if body else None))
