"""python -m app  ->  serves the API on http://127.0.0.1:5000 (override with HOST / PORT)."""
import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "5000")),
                reload=os.getenv("RELOAD", "").lower() in ("1", "true", "yes"))
