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
(LLM + Zod)
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
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL |
| Payment Integration | PayPal REST API, PayPal Sandbox |
| AI Safety | OpenAI API, Zod |
| Testing | Vitest |
| Deployment | Vercel, Render |

## Project Structure

```text
agentguard/
├── apps/
│   ├── web/                  # Next.js frontend
│   └── api/                  # Express backend
│
├── packages/
│   ├── shared/               # Shared types and schemas
│   ├── rules/                # Policy rules engine
│   ├── safety/               # AI safety and decision receipts
│   └── agent/                # AI shopping agent
│
├── data/                     # Product catalog and merchant data
├── docs/                     # Project documentation
├── package.json
├── package-lock.json
├── .env.example
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

- Node.js
- npm
- PostgreSQL
- PayPal Developer Sandbox account
- OpenAI API key

### 1. Clone the Repository

```bash
git clone https://github.com/nitheeshcitbecse-eng/Paypal_Hackathon.git
cd Paypal_Hackathon
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create `.env` files using the provided `.env.example` file and configure the required credentials.

```env
OPENAI_API_KEY=your_openai_api_key

PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com

DATABASE_URL=your_database_url

PORT=5000
NODE_ENV=development
```

### 4. Run the Application

```bash
npm run dev
```

## Team Responsibilities

| Team Member | Responsibility |
|---|---|
| Nitheesh S | Backend development and PayPal integration |
| Nitheesh | AI safety, policy rules engine, and testing |
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
