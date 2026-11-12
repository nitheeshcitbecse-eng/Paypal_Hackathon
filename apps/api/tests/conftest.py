import json

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.paypal import MockPayPal

BENIGN = json.dumps({"intent_match": True, "injection_detected": False, "risk_reason": "looks fine"})


def fake_llm(reply: str = BENIGN):
    async def llm(system: str, user: str) -> str:
        return reply
    return llm


@pytest.fixture
def make_client(tmp_path):
    clients = []

    def _make(llm=None, gateway=None, **settings_over):
        settings = Settings(db_path=str(tmp_path / f"test{len(clients)}.db"), **settings_over)
        app = create_app(settings, llm=llm or fake_llm(), gateway=gateway or MockPayPal())
        client = TestClient(app)
        client.__enter__()
        clients.append(client)
        return client

    yield _make
    for c in clients:
        c.__exit__(None, None, None)


@pytest.fixture
def client(make_client):
    return make_client()
