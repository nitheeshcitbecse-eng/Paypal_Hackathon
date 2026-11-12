# AgentGuard API (FastAPI)

The backend that sits between AI shopping agents and PayPal. Every purchase goes through
the AgentGuard AI engine (repo root, `agentguard_ai`): **AI safety check → hard rules →
allow / hold / block → receipt**. Only `allowed` and `held` purchases ever reach PayPal.

## Run

```bash
cd apps/api
pip install -r requirements.txt
cp .env.example .env            # optional: PayPal Sandbox credentials, CORS, API key
uvicorn app.main:app --reload --port 5000      # or: python -m app
```

- Swagger UI: http://localhost:5000/docs
- Base URL used by the frontend (`apps/web/lib/api.ts`): `http://localhost:5000/api`
- The repo-root `.env` (`LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`) configures the AI check.
  If the LLM can't start, the API still runs but **fails closed**: every purchase is blocked
  (`GET /api/health` shows why). `AGENTGUARD_OFFLINE=true` runs heuristics + rules only.
- PayPal: with no credentials the API uses a **mock** gateway (no network, no money). Set
  `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` to use the **PayPal Developer Sandbox**.
- Data is stored in SQLite (`apps/api/agentguard.db`, override with `DATABASE_PATH`). On first
  start it is seeded with the engine's demo rules and merchant registry (`eval_cases.py`).

## Tests

```bash
cd apps/api
python -m pytest
```

No network needed: the LLM is faked and PayPal Sandbox is simulated with `httpx.MockTransport`.

## Endpoints (all under `/api`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Status, LLM state, PayPal mode (no API key needed) |
| POST | `/purchase` | **Agent checkout.** Body = `PurchaseRequest` + optional `agent`. Returns `PurchaseResponse` + `transaction_id`, `payment_status`, `approve_url` |
| POST | `/evaluate` | Dry run of the decision pipeline (playground). No PayPal, nothing stored |
| GET / PUT | `/rules` | Read / replace rule settings (`spent_so_far` is server-owned) |
| POST | `/rules/reset-spend` | Reset `spent_so_far` to 0 (demo helper) |
| GET | `/merchants` | Merchant registry |
| GET / PUT / DELETE | `/merchants/{name}` | Read / upsert (`{rating, has_return_policy}`) / delete a merchant |
| GET | `/transactions?status=&q=&limit=&offset=` | Audit ledger, newest first. `status` = `Approved` \| `Held` \| `Blocked` |
| GET | `/transactions/{id}` | One ledger entry with its full decision receipt |
| POST | `/transactions/{id}/capture` | Sandbox: capture an approved order after the payer approved it |
| GET | `/receipts/{receipt_id}` | Look up a ledger entry by receipt id |
| GET | `/stats` | Budget, counts, blocked amount, 7-day spend (`[{day, date, amount}]`) |
| GET | `/approvals` | Held purchases waiting for a human, oldest first |
| POST | `/approvals/{id}/approve` | Approve (re-checks remaining budget, then captures) — body `{note?}` |
| POST | `/approvals/{id}/reject` | Reject and void the authorization — body `{note?}` |

Purchase, rules and merchant payloads use the engine's snake_case contract (`schemas.py`).
Ledger responses (`/transactions`, `/approvals`, `/receipts`) use **camelCase** and match the
`Transaction` type in `apps/web/mocks/data.ts` (`merchantInitials`, `product`, `amount`,
`status`, `receiptId`, ...) plus extra fields (`decision`, `approvalStatus`, `paymentStatus`,
`paypalOrderId`, `receipt`, `safety`). `date` is an ISO-8601 UTC timestamp.

Errors are JSON: `{"detail": "...", "transaction_id"?: "..."}` — 404 unknown id, 409 wrong
state (e.g. approving twice, budget no longer covers it), 422 validation, 502 PayPal failure
(no money moved), 401 missing `X-API-Key` when `AGENTGUARD_API_KEY` is set.

## Payment flow

| Decision | PayPal | Budget |
|---|---|---|
| allowed | Order `intent=CAPTURE` (mock: completed immediately) | counted |
| held | Order `intent=AUTHORIZE` — reserved, not charged | counted only when approved |
| blocked | never called | — |

In the Sandbox, an order must be approved by the sandbox buyer (`approve_url`) before it can
be captured. If a human approves a held purchase first, `paymentStatus` becomes
`PAYER_ACTION_REQUIRED`; call `POST /transactions/{id}/capture` after the buyer approves.

Purchases are serialized around the rules check and budget update, so concurrent agent calls
can't overspend the budget. The AI check runs outside that lock.

## Example

```bash
curl -X POST localhost:5000/api/purchase -H "Content-Type: application/json" -d '{
  "task": "Buy a phone case under $20", "item": "Clear silicone phone case", "price": 15,
  "merchant": "TechMart", "category": "accessories", "page_text": "Slim clear case.",
  "agent": "ResearchPilot"
}'
```

## Layout

```text
apps/api/
├── app/
│   ├── main.py      # app factory, lifespan, CORS, error handling
│   ├── routes.py    # HTTP endpoints
│   ├── service.py   # engine -> decision -> PayPal -> ledger
│   ├── engine.py    # loads the repo-root AI engine as `agentguard_ai` (unmodified)
│   ├── paypal.py    # MockPayPal + PayPalSandbox (OAuth2, Orders v2, Payments v2)
│   ├── store.py     # SQLite: rules, merchants, transactions
│   ├── models.py    # API request/response models
│   └── config.py    # environment settings
└── tests/
```
