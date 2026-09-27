import hashlib
import time

from fastapi import Header, HTTPException
from supabase import create_client

from .config import SUPABASE_SERVICE_KEY, SUPABASE_URL

_sb = None


def _get_sb():
    global _sb
    if _sb is None:
        _sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _sb


_user_cache: dict = {}
_USER_TTL = 60


def _uh(tok: str) -> str:
    return hashlib.sha256(tok.encode()).hexdigest()[:16]


def get_current_user(authorization: str = Header("")) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")
    jwt = authorization[7:]
    cached = _user_cache.get(_uh(jwt))
    if cached is not None and time.time() - cached[0] < _USER_TTL:
        return cached[1]
    try:
        # Server-side validation via Auth API: agnostic to the project's
        # JWT signing algorithm (new projects use ECC, not HS256).
        resp = _get_sb().auth.get_user(jwt)
    except Exception:
        raise HTTPException(401, "invalid token")
    if not resp.user:
        raise HTTPException(401, "invalid token")
    user_id = str(resp.user.id)
    _user_cache[_uh(jwt)] = (time.time(), user_id)
    return user_id
