"""
Payment gateways.

  MockPayPal     no network, no money. Default when no PayPal credentials are configured.
  PayPalSandbox  PayPal REST API (OAuth2 client credentials + Orders v2 + Payments v2).

Allowed purchases create an order with intent CAPTURE; held purchases create an order with
intent AUTHORIZE, so the amount is only reserved until a human approves it.
"""
import asyncio
import logging
import time
import uuid
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Optional, Protocol

import httpx

logger = logging.getLogger("agentguard_api.paypal")

PAYER_ACTION_ISSUES = {"ORDER_NOT_APPROVED", "PAYER_ACTION_REQUIRED"}


class PaymentError(Exception):
    def __init__(self, message: str, *, name: Optional[str] = None, status_code: Optional[int] = None,
                 debug_id: Optional[str] = None):
        super().__init__(message)
        self.name = name
        self.status_code = status_code
        self.debug_id = debug_id
        self.authorization_id: Optional[str] = None


class PayerActionRequired(PaymentError):
    """The order exists but the PayPal payer has not approved it yet."""


@dataclass
class OrderResult:
    order_id: str
    status: str
    approve_url: Optional[str] = None
    authorization_id: Optional[str] = None
    capture_id: Optional[str] = None


@dataclass
class SettleResult:
    status: str
    capture_id: Optional[str] = None
    authorization_id: Optional[str] = None


class PaymentGateway(Protocol):
    mode: str

    async def create_order(self, *, reference_id: str, description: str, amount: float, currency: str,
                           intent: str) -> OrderResult: ...

    async def settle(self, order_id: str, intent: str, *, request_key: str,
                     authorization_id: Optional[str] = None) -> SettleResult: ...

    async def cancel(self, order_id: str, *, request_key: str, authorization_id: Optional[str] = None) -> str: ...

    async def aclose(self) -> None: ...


def format_amount(amount: float) -> str:
    return str(Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


# ----------------------------------------------------------------------------- mock
class MockPayPal:
    """Simulates PayPal: CAPTURE orders complete instantly, AUTHORIZE orders are reserved."""
    mode = "mock"

    @staticmethod
    def _id(prefix: str) -> str:
        return f"{prefix}-{uuid.uuid4().hex[:16].upper()}"

    async def create_order(self, *, reference_id: str, description: str, amount: float, currency: str,
                           intent: str) -> OrderResult:
        if intent == "CAPTURE":
            return OrderResult(order_id=self._id("MOCK"), status="COMPLETED", capture_id=self._id("CAP"))
        return OrderResult(order_id=self._id("MOCK"), status="AUTHORIZED", authorization_id=self._id("AUTH"))

    async def settle(self, order_id: str, intent: str, *, request_key: str,
                     authorization_id: Optional[str] = None) -> SettleResult:
        return SettleResult(status="COMPLETED", capture_id=self._id("CAP"), authorization_id=authorization_id)

    async def cancel(self, order_id: str, *, request_key: str, authorization_id: Optional[str] = None) -> str:
        return "VOIDED"

    async def aclose(self) -> None:
        return None


# ----------------------------------------------------------------------------- sandbox
def _first_payment(data: dict, kind: str) -> dict:
    try:
        return data["purchase_units"][0]["payments"][kind][0] or {}
    except (KeyError, IndexError, TypeError):
        return {}


def _error_from(resp: httpx.Response) -> PaymentError:
    try:
        body: Any = resp.json()
    except ValueError:
        body = {}
    if not isinstance(body, dict):
        body = {}
    name = body.get("name") or body.get("error")
    message = body.get("message") or body.get("error_description") or f"PayPal returned HTTP {resp.status_code}"
    details = body.get("details") or []
    issue = details[0].get("issue") if details and isinstance(details[0], dict) else None
    if issue:
        message = f"{message} ({issue})"
    cls = PayerActionRequired if issue in PAYER_ACTION_ISSUES else PaymentError
    return cls(message, name=issue or name, status_code=resp.status_code, debug_id=body.get("debug_id"))


class PayPalSandbox:
    mode = "sandbox"

    def __init__(self, client_id: str, client_secret: str, base_url: str, *, timeout: float = 20.0,
                 transport: Optional[httpx.AsyncBaseTransport] = None):
        self._client_id = client_id
        self._client_secret = client_secret
        self._http = httpx.AsyncClient(base_url=base_url, timeout=timeout, transport=transport)
        self._token: Optional[str] = None
        self._token_expiry = 0.0
        self._token_lock = asyncio.Lock()

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _get_token(self, force: bool = False) -> str:
        async with self._token_lock:
            if not force and self._token and time.monotonic() < self._token_expiry:
                return self._token
            try:
                resp = await self._http.post(
                    "/v1/oauth2/token", data={"grant_type": "client_credentials"},
                    auth=(self._client_id, self._client_secret), headers={"Accept": "application/json"},
                )
            except httpx.HTTPError as exc:
                raise PaymentError(f"Could not reach PayPal: {type(exc).__name__}") from exc
            if resp.status_code != 200:
                raise PaymentError("PayPal rejected the API credentials.", name="AUTHENTICATION_FAILURE",
                                   status_code=resp.status_code)
            data = resp.json()
            self._token = data["access_token"]
            self._token_expiry = time.monotonic() + max(int(data.get("expires_in", 300)) - 60, 30)
            return self._token

    async def _call(self, method: str, path: str, *, json: Optional[dict] = None,
                    request_id: Optional[str] = None) -> dict:
        resp: Optional[httpx.Response] = None
        for attempt in range(2):
            token = await self._get_token(force=attempt == 1)
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Prefer": "return=representation",
            }
            if request_id:
                headers["PayPal-Request-Id"] = request_id  # idempotency key
            try:
                resp = await self._http.request(method, path, json=json if json is not None else {}, headers=headers)
            except httpx.HTTPError as exc:
                raise PaymentError(f"Could not reach PayPal: {type(exc).__name__}") from exc
            if resp.status_code != 401:
                break  # 401 once = expired token -> refresh and retry
        assert resp is not None
        if resp.status_code >= 400:
            err = _error_from(resp)
            logger.warning("PayPal %s %s failed: %s (debug_id=%s)", method, path, err, err.debug_id)
            raise err
        return resp.json() if resp.content else {}

    async def create_order(self, *, reference_id: str, description: str, amount: float, currency: str,
                           intent: str) -> OrderResult:
        body = {
            "intent": intent,
            "purchase_units": [{
                "reference_id": reference_id,
                "custom_id": reference_id[:127],
                "description": description[:127],
                "amount": {"currency_code": currency, "value": format_amount(amount)},
            }],
        }
        data = await self._call("POST", "/v2/checkout/orders", json=body, request_id=f"{reference_id}-create")
        links = {link.get("rel"): link.get("href") for link in data.get("links", [])}
        return OrderResult(order_id=data["id"], status=data.get("status", "CREATED"),
                           approve_url=links.get("approve") or links.get("payer-action"))

    async def settle(self, order_id: str, intent: str, *, request_key: str,
                     authorization_id: Optional[str] = None) -> SettleResult:
        if intent == "CAPTURE":
            data = await self._call("POST", f"/v2/checkout/orders/{order_id}/capture",
                                    request_id=f"{request_key}-capture")
            cap = _first_payment(data, "captures")
            return SettleResult(status=cap.get("status") or data.get("status", "COMPLETED"), capture_id=cap.get("id"))

        if not authorization_id:
            data = await self._call("POST", f"/v2/checkout/orders/{order_id}/authorize",
                                    request_id=f"{request_key}-authorize")
            authorization_id = _first_payment(data, "authorizations").get("id")
            if not authorization_id:
                raise PaymentError("PayPal did not return an authorization for this order.")
        try:
            data = await self._call("POST", f"/v2/payments/authorizations/{authorization_id}/capture",
                                    request_id=f"{request_key}-capture")
        except PaymentError as exc:
            exc.authorization_id = authorization_id
            raise
        return SettleResult(status=data.get("status", "COMPLETED"), capture_id=data.get("id"),
                            authorization_id=authorization_id)

    async def cancel(self, order_id: str, *, request_key: str, authorization_id: Optional[str] = None) -> str:
        # An order that was never authorized holds no funds; PayPal expires it automatically.
        if authorization_id:
            await self._call("POST", f"/v2/payments/authorizations/{authorization_id}/void",
                             request_id=f"{request_key}-void")
        return "VOIDED"
