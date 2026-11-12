"""PayPalSandbox against a fake PayPal (httpx.MockTransport): no network."""
import asyncio
import json

import httpx
import pytest

from app.paypal import PayerActionRequired, PaymentError, PayPalSandbox, format_amount

from .conftest import fake_llm


class FakePayPal:
    def __init__(self, payer_approved: bool = True):
        self.payer_approved = payer_approved
        self.calls = []
        self.tokens_issued = 0
        self.expire_next = False

    def __call__(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        self.calls.append((request.method, path, request.headers.get("PayPal-Request-Id")))
        if path == "/v1/oauth2/token":
            assert request.headers["Authorization"].startswith("Basic ")
            self.tokens_issued += 1
            return httpx.Response(200, json={"access_token": f"tok{self.tokens_issued}", "expires_in": 32400})
        if self.expire_next:
            self.expire_next = False
            return httpx.Response(401, json={"error": "invalid_token"})
        assert request.headers["Authorization"].startswith("Bearer tok")
        if path == "/v2/checkout/orders":
            body = json.loads(request.content)
            return httpx.Response(201, json={
                "id": "ORDER123", "status": "CREATED", "intent": body["intent"],
                "links": [{"rel": "self", "href": "x"},
                          {"rel": "approve", "href": "https://www.sandbox.paypal.com/checkoutnow?token=ORDER123"}],
            })
        if not self.payer_approved and (path.endswith("/capture") or path.endswith("/authorize")) \
                and path.startswith("/v2/checkout"):
            return httpx.Response(422, json={"name": "UNPROCESSABLE_ENTITY", "message": "The requested action could not be performed.",
                                             "details": [{"issue": "ORDER_NOT_APPROVED"}], "debug_id": "dbg1"})
        if path == "/v2/checkout/orders/ORDER123/capture":
            return httpx.Response(201, json={"status": "COMPLETED", "purchase_units": [
                {"payments": {"captures": [{"id": "CAP1", "status": "COMPLETED"}]}}]})
        if path == "/v2/checkout/orders/ORDER123/authorize":
            return httpx.Response(201, json={"status": "COMPLETED", "purchase_units": [
                {"payments": {"authorizations": [{"id": "AUTH1", "status": "CREATED"}]}}]})
        if path == "/v2/payments/authorizations/AUTH1/capture":
            return httpx.Response(201, json={"id": "CAP2", "status": "COMPLETED"})
        if path == "/v2/payments/authorizations/AUTH1/void":
            return httpx.Response(204)
        return httpx.Response(404, json={"name": "RESOURCE_NOT_FOUND", "message": "nope"})


def sandbox(fake: FakePayPal) -> PayPalSandbox:
    return PayPalSandbox("id", "secret", "https://api-m.sandbox.paypal.com", transport=httpx.MockTransport(fake))


def test_format_amount():
    assert format_amount(15) == "15.00" and format_amount(19.995) == "20.00" and format_amount(0.1) == "0.10"


def test_create_capture_and_token_reuse():
    fake = FakePayPal()

    async def run():
        pp = sandbox(fake)
        order = await pp.create_order(reference_id="AG-1", description="Case", amount=15, currency="USD", intent="CAPTURE")
        settled = await pp.settle(order.order_id, "CAPTURE", request_key="AG-1")
        await pp.aclose()
        return order, settled

    order, settled = asyncio.run(run())
    assert order.order_id == "ORDER123" and order.approve_url.endswith("token=ORDER123")
    assert settled.status == "COMPLETED" and settled.capture_id == "CAP1"
    assert fake.tokens_issued == 1
    assert ("POST", "/v2/checkout/orders", "AG-1-create") in fake.calls


def test_authorize_then_capture_and_void():
    fake = FakePayPal()

    async def run():
        pp = sandbox(fake)
        settled = await pp.settle("ORDER123", "AUTHORIZE", request_key="AG-2")
        voided = await pp.cancel("ORDER123", request_key="AG-2", authorization_id="AUTH1")
        await pp.aclose()
        return settled, voided

    settled, voided = asyncio.run(run())
    assert settled.authorization_id == "AUTH1" and settled.capture_id == "CAP2"
    assert voided == "VOIDED"


def test_unapproved_order_raises_payer_action_required():
    async def run():
        pp = sandbox(FakePayPal(payer_approved=False))
        try:
            await pp.settle("ORDER123", "CAPTURE", request_key="AG-3")
        finally:
            await pp.aclose()

    with pytest.raises(PayerActionRequired):
        asyncio.run(run())


def test_expired_token_is_refreshed_once():
    fake = FakePayPal()

    async def run():
        pp = sandbox(fake)
        await pp.create_order(reference_id="AG-4", description="x", amount=1, currency="USD", intent="CAPTURE")
        fake.expire_next = True
        await pp.settle("ORDER123", "CAPTURE", request_key="AG-4")
        await pp.aclose()

    asyncio.run(run())
    assert fake.tokens_issued == 2


def test_bad_credentials():
    def handler(request):
        return httpx.Response(401, json={"error": "invalid_client"})

    async def run():
        pp = PayPalSandbox("id", "bad", "https://api-m.sandbox.paypal.com", transport=httpx.MockTransport(handler))
        try:
            await pp.create_order(reference_id="AG-5", description="x", amount=1, currency="USD", intent="CAPTURE")
        finally:
            await pp.aclose()

    with pytest.raises(PaymentError, match="credentials"):
        asyncio.run(run())


def test_sandbox_end_to_end_held_purchase_needs_payer_then_captures(make_client):
    """Held order in Sandbox: human approves before the payer does -> capture later via /capture."""
    fake = FakePayPal(payer_approved=False)
    client = make_client(gateway=sandbox(fake), llm=fake_llm())
    body = client.post("/api/purchase", json={
        "task": "Buy wireless headphones", "item": "Headphones", "price": 130, "merchant": "TechMart",
        "category": "electronics", "page_text": "Over-ear.",
    }).json()
    assert body["decision"] == "held" and body["approve_url"]
    tx_id = body["transaction_id"]

    tx = client.post(f"/api/approvals/{tx_id}/approve").json()
    assert tx["status"] == "Approved" and tx["paymentStatus"] == "PAYER_ACTION_REQUIRED"
    assert client.post(f"/api/transactions/{tx_id}/capture").status_code == 409

    fake.payer_approved = True  # payer clicks the approve link in the Sandbox
    tx = client.post(f"/api/transactions/{tx_id}/capture").json()
    assert tx["paymentStatus"] == "COMPLETED"
    assert client.post(f"/api/transactions/{tx_id}/capture").status_code == 409
