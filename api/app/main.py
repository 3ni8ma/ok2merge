import logging

from fastapi import FastAPI

from .routes import github_connect, prs

logging.basicConfig(level=logging.INFO)
app = FastAPI()
app.include_router(github_connect.router)
app.include_router(prs.router)


@app.get("/health")
def health():
    return {"ok": True}
