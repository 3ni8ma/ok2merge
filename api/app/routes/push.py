from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Literal

from ..deps import get_current_user
from ..store import sb

router = APIRouter()


class PushBody(BaseModel):
    fcm_token: str
    platform: Literal["ios", "android"]


@router.post("/api/push/register")
def register(b: PushBody, user_id: str = Depends(get_current_user)):
    sb.table("push_tokens").upsert(
        {"user_id": user_id, "fcm_token": b.fcm_token, "platform": b.platform}
    ).execute()
    return {"ok": True}
