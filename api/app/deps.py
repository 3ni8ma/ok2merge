from fastapi import Header, HTTPException
from supabase import create_client

from .config import SUPABASE_SERVICE_KEY, SUPABASE_URL

_sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_current_user(authorization: str = Header("")) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")
    try:
        # Server-side validation via Auth API: agnostic to the project's
        # JWT signing algorithm (new projects use ECC, not HS256).
        resp = _sb.auth.get_user(authorization[7:])
    except Exception:
        raise HTTPException(401, "invalid token")
    if not resp.user:
        raise HTTPException(401, "invalid token")
    return str(resp.user.id)
