# Member 3 — AgentGuard Shopping Agent

Place this folder at `packages/agent/` in the shared PayPal Hackathon repository.
The accompanying `data/` folder belongs at the repository root.

## Included
- `search_products(query)`
- `get_product_page(productId)`
- `request_purchase(productId, userTask)`
- `run_demo(scenario)` with safe, injection, over-budget, and low-rating scenarios
- 18 simulated products and 2 simulated merchant records

## Run the demo
From `packages/agent`:

```bash
npm install
npm run demo
```

Requires Node.js 20+.

## Backend handoff
`request_purchase` returns a purchase-request object containing product, amount, merchant, page text, and agent notes. The backend teammate should POST this object to the backend's purchase-request endpoint. The backend safety/rules engine must make the final decision.

## Safety boundary
This package never calls PayPal and never authorizes or captures a payment. Product page text is untrusted data. Merchant ratings and return policies are simulated and must not be represented as verified real-world information.

## Integration note
This is a standalone Member 3 module, not a replacement for `apps/web`, `apps/api`, or the safety/rules packages. The backend should own final approval/hold/block decisions in the integrated application.
