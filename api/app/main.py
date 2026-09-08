import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import account, github_connect, prs, push, reviews, webhooks

logging.basicConfig(level=logging.INFO)
app = FastAPI()

# Browsers block cross-origin calls without this. The PWA calls the API from
# a different domain, so its origin must be explicitly allowed.
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "https://ok2merge.vercel.app,"
        "http://localhost:5173,http://localhost:3000,"
        "capacitor://localhost,https://localhost,"
        "ok2merge://onboarding",
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)
app.include_router(account.router)
app.include_router(github_connect.router)
app.include_router(prs.router)
app.include_router(push.router)
app.include_router(reviews.router)
app.include_router(webhooks.router)


@app.get("/health")
def health():
    return {"ok": True}
