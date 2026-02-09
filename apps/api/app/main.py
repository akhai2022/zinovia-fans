from __future__ import annotations

from collections.abc import Awaitable, Callable
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.logging import configure_logging
from app.core.request_id import get_request_id, set_request_id
from app.core.settings import get_settings
from app.health import check_db, check_redis
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.creators.router import router as creators_router
from app.modules.ledger.router import router as ledger_router
from app.modules.media.router import router as media_router
from app.modules.posts.router import feed_router, router as posts_router


def create_app() -> FastAPI:
    app = FastAPI(title="Zinovia Fans API")

    settings = get_settings()
    # For now allow any origin by reflecting the request Origin (required when allow_credentials=True; "*" is not valid with credentials).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
    # Reflect Origin so credentials work with any origin (CORSMiddleware cannot send "*" when credentials=True).
    @app.middleware("http")
    async def cors_reflect_origin(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        origin = request.headers.get("origin")
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
        return response

    configure_logging(get_request_id)

    @app.middleware("http")
    async def request_id_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("X-Request-Id") or get_request_id()
        set_request_id(request_id)
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"error": "internal_server_error", "request_id": get_request_id()},
        )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready")
    async def ready() -> dict[str, object]:
        db_ok = await check_db()
        redis_ok = await check_redis()
        status = "ok" if db_ok and redis_ok else "degraded"
        return {
            "status": status,
            "checks": {"database": db_ok, "redis": redis_ok},
        }

    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(creators_router, prefix="/creators", tags=["creators"])
    app.include_router(posts_router, prefix="/posts", tags=["posts"])
    app.include_router(feed_router, tags=["feed"])
    app.include_router(media_router, prefix="/media", tags=["media"])
    app.include_router(billing_router, prefix="/billing", tags=["billing"])
    app.include_router(ledger_router, prefix="/ledger", tags=["ledger"])
    return app


app = create_app()
