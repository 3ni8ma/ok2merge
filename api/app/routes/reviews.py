import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from typing import Literal

from ..deps import get_current_user
from ..store import read_github_token, sb

router = APIRouter()


class ReviewBody(BaseModel):
    repo: str
    number: int
    event: Literal["APPROVE", "REQUEST_CHANGES", "COMMENT"]
    body: str = ""
    key: str

    @field_validator("event", mode="before")
    @classmethod
    def upper(cls, v: str) -> str:
        return str(v).upper()


@router.post("/api/reviews")
def post_review(b: ReviewBody, user_id: str = Depends(get_current_user)):
    seen = (
        sb.table("idempotency_keys")
        .select("status,body")
        .eq("user_id", user_id)
        .eq("key", b.key)
        .execute()
        .data
    )
    if seen:
        return seen[0]["body"]
    found = read_github_token(user_id)
    if not found:
        raise HTTPException(409, "github not connected")
    token, _ = found
    r = httpx.post(
        f"https://api.github.com/repos/{b.repo}/pulls/{b.number}/reviews",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
        },
        json={"event": b.event, "body": b.body},
        timeout=20,
    )
    if r.status_code not in (200, 201):
        raise HTTPException(502, f"github rejected review: {r.status_code}")
    out = {"ok": True, "id": r.json().get("id")}
    sb.table("idempotency_keys").insert(
        {"user_id": user_id, "key": b.key, "status": r.status_code, "body": out}
    ).execute()
    return out
