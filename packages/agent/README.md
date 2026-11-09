# Member 3 - Python AgentGuard Shopping Agent

A Python, standard-library-only prototype for the Member 3 shopping-agent module.

## Files
- `agent.py`: product search, product-page retrieval, purchase-request checks, and demo runner.
- `demo.py`: runs four repeatable scenarios.
- `../../data/catalog.json`: simulated product catalog (18 products).
- `../../data/merchants.json`: simulated merchant registry (2 merchants).

## Run from the repository root

```bash
python -m packages.agent.demo
```

## Use from another Python module

```python
from packages.agent import search_products, get_product_page, request_purchase, run_demo

products = search_products("wireless mouse")
page = get_product_page("P001")
request = request_purchase("P001", "Find a wireless mouse", budget=1500)
print(run_demo("injection"))
```

## Demo scenarios
- `safe`: ordinary product from the higher-rated simulated merchant.
- `injection`: product page contains a prompt-injection test string; request is blocked.
- `over-budget`: product is above the demo budget; request is held.
- `low-rating`: product is from the low-rated simulated merchant; request is blocked.

## Important limitations
- Catalog, merchant ratings, and return policies are simulated data, not live marketplace information.
- The prompt-injection detector is a simple demonstration, not a production security solution.
- This module creates a purchase-request result only. It does not call PayPal or authorize/capture payments.
- The backend/rules-engine teammate should apply the project's authoritative policy checks before any real payment workflow.
