import os

import httpx
from fastapi import APIRouter, Depends

from ..deps import get_current_user
from ..store import read_github_token, sb

router = APIRouter()


@router.delete("/api/account")
def wipe(user_id: str = Depends(get_current_user)):
    found = read_github_token(user_id)
    if found:  # best-effort revoke of the OAuth grant; never log the token
        token, _ = found
        # NOTE: httpx.delete() takes no body kwargs; use request() for DELETE+JSON.
        httpx.request(
            "DELETE",
            f"https://api.github.com/applications/{os.environ['GITHUB_CLIENT_ID']}/grant",
            auth=(
                os.environ["GITHUB_CLIENT_ID"],
                os.environ["GITHUB_CLIENT_SECRET"],
            ),
            json={"access_token": token},
            timeout=15,
        )
    for table in (
        "push_tokens",
        "summary_cache",
        "entitlements",
        "idempotency_keys",
        "github_tokens",
        "profiles",
    ):
        sb.table(table).delete().eq("user_id", user_id).execute()
    sb.auth.admin.delete_user(user_id)
    return {"ok": True}
