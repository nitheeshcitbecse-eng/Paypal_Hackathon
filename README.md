# PayPal AgentGuard

## Dynamic Policy Delegation & Guardrail Middleware for Autonomous AI Agent Checkout

PayPal AgentGuard is a security middleware that enables autonomous AI shopping agents to make purchases through PayPal while enforcing user-defined spending limits and safety policies.

It acts as a protective layer between AI shopping agents and the PayPal Developer Platform Sandbox, ensuring that every purchase request is validated before execution.

## Key Features

- **AI Safety Validation:** Detects prompt injection attacks and purchase intent mismatches using an LLM.
- **Policy Enforcement:** Validates transactions against user-defined budgets and category restrictions.
- **Merchant Verification:** Checks merchant trust scores and return policies.
- **Automated Approval:** Allows purchases that satisfy all configured policies.
- **Human Approval:** Holds transactions that exceed the automatic approval threshold.
- **Transaction Blocking:** Rejects suspicious or unauthorized purchase requests.
- **Decision Receipts:** Generates explanations for every transaction decision.

## System Workflow

```text
AI Shopping Agent
       |
       v
AgentGuard Middleware
       |
       v
AI Safety Validation
(LLM + regex heuristics)
       |
       v
Rules Engine
(Budget, Category, Merchant)
       |
       v
Decision Gateway
       |
       +----------+----------+
       |          |          |
       v          v          v
     ALLOW       HOLD       BLOCK
       |          |          |
       v          v          v
    PayPal     Human      Transaction
    Sandbox   Approval     Rejected
```

## Tech Stack

| Component | Technologies |
|---|---|
| Frontend | Next.js, React, Tailwind CSS |
| Backend | Python, FastAPI, Uvicorn |
| Database | SQLite |
| Payment Integration | PayPal REST API (Orders v2), PayPal Sandbox |
| AI Safety | Groq / Anthropic / OpenAI (configurable), Pydantic |
| Testing | pytest |

## Project Structure

```text
Paypal_Hackathon/
├── apps/
│   ├── web/                  # Next.js dashboard (Overview, Playground, Rules, Approvals, Audit)
│   │   ├── app/              # Pages, all backed by the API
│   │   ├── components/       # Shared navigation and UI components
│   │   └── lib/              # API client, types, formatting, hooks
│   └── api/                  # FastAPI backend (see apps/api/README.md)
│       ├── app/              # Routes, service, PayPal client, SQLite store
│       └── tests/
│
├── *.py                      # AI engine (agentguard_ai): safety check, rules, receipts
├── tests/                    # AI engine tests
├── requirements.txt          # AI engine dependencies
└── README.md
```

## Demo Scenarios

| Scenario | Expected Outcome |
|---|---|
| Purchase within budget from a trusted merchant | ALLOW |
| Malicious prompt injection in a product page | BLOCK |
| High-value purchase exceeding the approval threshold | HOLD |

## Installation and Setup

### Prerequisites

- Python 3.9+
- Node.js 20+ and npm
- An LLM API key (Groq is free) for the AI safety check
- Optional: PayPal Developer Sandbox account (without one, a mock PayPal is used)

### 1. Clone the Repository

```bash
git clone https://github.com/nitheeshcitbecse-eng/Paypal_Hackathon.git
cd Paypal_Hackathon
```

### 2. Configure the AI safety check

Create `.env` in the repository root:

```env
LLM_PROVIDER=groq
LLM_API_KEY=your-key-here
```

After starting the backend, `http://localhost:5000/api/health` should report `"llm": "ready"`.

### 3. Run the Backend (FastAPI)

```bash
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5000
```

API docs: [http://localhost:5000/docs](http://localhost:5000/docs). For PayPal Sandbox payments, copy
`apps/api/.env.example` to `apps/api/.env` and set `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`.

### 4. Run the Frontend

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Every page reads from and writes to the backend.
To use a backend on another address, set `NEXT_PUBLIC_API_URL` in `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Never expose private API credentials through `NEXT_PUBLIC_*` variables.

### 5. Run the Tests

```bash
python -m pytest              # AI engine (repo root)
cd apps/api && python -m pytest   # backend
```

## Team Responsibilities

| Team Member | Responsibility |
|---|---|
| Nitheesh S | Backend development and PayPal integration |
| Nithesh Kumar P | AI safety, policy rules engine, and testing |
| Abijeeth | AI shopping agent and adversarial attack scenarios |
| Minhu Parthasarathy | Frontend development and dashboard |

## Security

- AI agents do not receive unrestricted payment access.
- Every purchase is validated against configured policies.
- Suspicious transactions are blocked.
- High-value transactions require human approval.
- Payment operations are tested using PayPal Sandbox.

## Project Objective

PayPal AgentGuard aims to make autonomous AI-powered shopping safer by combining AI-based threat detection, deterministic policy enforcement, and human authorization.

**AI proposes. Rules decide. Users stay in control.**
