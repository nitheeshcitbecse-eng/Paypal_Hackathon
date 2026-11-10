import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi.encoders import jsonable_encoder

from packages.agent.agent import request_purchase
from backend.llm_agent import get_shopping_response

load_dotenv()

app = FastAPI(
    title="AgentGuard Shopping Agent API",
    description="Gemini-powered shopping assistant with a separate safety-checked purchase-request endpoint.",
    version="1.0.0",
)

# For local frontend development. Change this to your deployed frontend URL later.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=2, max_length=2000)


class PurchaseRequest(BaseModel):
    product_id: str = Field(..., min_length=1, max_length=30)
    user_task: str = Field(..., min_length=2, max_length=1000)
    budget: Optional[float] = Field(default=None, gt=0)


@app.get("/")
def home():
    return {"message": "AgentGuard backend is running"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
    }


@app.post("/chat")
def chat(request: ChatRequest):
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is missing. Add GEMINI_API_KEY to your .env file.",
        )

    try:
        result = get_shopping_response(request.message)
        return {"reply": result}
    except Exception as exc:
        # Do not expose API keys or full internal exception details to the frontend.
        print("Chat error:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="The shopping assistant could not complete the request.",
        )


@app.post("/purchase-request")
def create_purchase_request(request: PurchaseRequest):
    """
    This only creates a purchase request through the existing agent.
    It does NOT authorize, capture, or transfer any PayPal payment.
    Call this endpoint only after the user explicitly chooses a product.
    """
    try:
        result = request_purchase(
            request.product_id,
            user_task=request.user_task,
            budget=request.budget,
        )
        return {"purchase_request": jsonable_encoder(result)}
    except Exception as exc:
        print("Purchase request error:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not create the purchase request.",
        )
