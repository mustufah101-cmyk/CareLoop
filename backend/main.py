"""
CareLoop — FastAPI Application Entry Point
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import database
from routers import checkins, documents, during, episodes

# ── Load environment ──────────────────────────────────────────────────────────

load_dotenv()

# ── Lifespan ──────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    database.init_db()
    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CareLoop API",
    description=(
        "AI copilot that follows one patient through a healthcare episode "
        "— Before, During, and After their appointment."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(episodes.router)
app.include_router(documents.router)
app.include_router(checkins.router)
app.include_router(during.router)


# ── Health check ──────────────────────────────────────────────────────────────


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "service": "careloop-api"}


# ── Dev entrypoint ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True,
    )
