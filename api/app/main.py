import logging

from fastapi import Depends, FastAPI

from .deps import get_current_user

logging.basicConfig(level=logging.INFO)
app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/prs")
def prs_placeholder(user_id: str = Depends(get_current_user)):
    return {"user": user_id, "prs": []}  # replaced in Task 5
