# AgentGuard FastAPI + Gemini backend

This backend is designed to sit beside the existing `packages/agent` module.

## Expected project structure

```text
Paypal_Hackathon/
├── data/
│   ├── catalog.json
│   └── merchants.json
├── packages/
│   └── agent/
│       ├── __init__.py
│       ├── agent.py
│       └── ...
├── backend/
│   ├── __init__.py
│   ├── main.py
│   ├── llm_agent.py
│   └── requirements.txt
└── .env
```

Important: the existing Python module must be importable as `packages.agent.agent`.
Run the commands below from the repository root (the folder containing `packages` and `backend`).

## 1. Install dependencies

```bash
python -m pip install -r backend/requirements.txt
```

## 2. Add your Gemini API key

Copy `.env.example` to `.env`, then replace the placeholder with your own key:

```text
GEMINI_API_KEY=your_actual_key
```

Never upload `.env` to GitHub. Add `.env` to `.gitignore`.

## 3. Start the API

```bash
python -m uvicorn backend.main:app --reload
```

Open:
- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/docs`

## 4. Test the chat endpoint

In `/docs`, open `POST /chat`, click **Try it out**, and send:

```json
{
  "message": "Find me headphones under 2000"
}
```

## 5. Test purchase-request creation

Only after choosing a product from the returned catalog results, use `POST /purchase-request` with its real product ID:

```json
{
  "product_id": "P001",
  "user_task": "The user selected this product after reviewing the results.",
  "budget": 2000
}
```

This calls the existing `request_purchase` function. It creates a purchase request only; it does not authorize or capture a PayPal payment.

## Safety notes

- Gemini can call only the catalog search and product-detail tools.
- The purchase-request endpoint is separate from chat.
- The existing `request_purchase` function and the team's safety/rules engine remain responsible for purchase checks.
- Product-page content is treated as untrusted data.
- The API key stays on the backend, never in frontend code.

If your existing `agent.py` uses different function names or argument names, update the imports/calls in `llm_agent.py` and `main.py` to match it.
