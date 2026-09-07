import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import get_current_user
from ..store import sb, store_github_token

router = APIRouter()


class ConnectBody(BaseModel):
    token: str
    login: str


@router.post("/api/github/connect")
def connect(body: ConnectBody, user_id: str = Depends(get_current_user)):
    me = httpx.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {body.token}"},
        timeout=15,
    )
    if me.status_code != 200:
        raise HTTPException(502, "github token rejected by github")
    store_github_token(user_id, body.token, body.login)
    sb.table("profiles").upsert({"user_id": user_id}).execute()
    sb.table("entitlements").upsert({"user_id": user_id}).execute()
    return {"ok": True, "login": body.login}


@router.delete("/api/github/connect")
def disconnect(user_id: str = Depends(get_current_user)):
    sb.table("github_tokens").delete().eq("user_id", user_id).execute()
    return {"ok": True}
