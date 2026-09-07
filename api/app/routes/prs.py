from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_current_user
from ..github import search_review_requested
from ..store import read_github_token

router = APIRouter()


@router.get("/api/prs")
def inbox(user_id: str = Depends(get_current_user)):
    found = read_github_token(user_id)
    if not found:
        raise HTTPException(409, "github not connected")
    token, login = found
    return {"prs": search_review_requested(token, login)}
