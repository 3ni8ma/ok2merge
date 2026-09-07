import jwt
from fastapi import Header, HTTPException

from .config import SUPABASE_JWT_SECRET


def get_current_user(authorization: str = Header("")) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")
    try:
        payload = jwt.decode(
            authorization[7:],
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except Exception:
        raise HTTPException(401, "invalid token")
    return str(payload["sub"])
