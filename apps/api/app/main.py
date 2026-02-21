from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.logging import configure_logging
from app.core.request_id import get_request_id, set_request_id
from app.core.settings import get_settings

# Sentry: initialize if SENTRY_DSN is set
_settings = get_settings()
if _settings.sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=_settings.sentry_dsn,
            traces_sample_rate=float(getattr(_settings, "sentry_traces_sample_rate", 0.1)),
            environment=_settings.environment,
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
            ],
        )
    except ImportError:
        pass  # sentry-sdk not installed; skip
from app.health import check_db, check_redis
from app.modules.ai.brand_router import router as brand_router
from app.modules.ai.router import router as ai_router
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.billing.webhook_alias_router import router as billing_webhook_alias_router
from app.modules.creator_earnings.router import router as creator_earnings_router
from app.modules.creators.router import router as creators_router
from app.modules.future.router import router as future_router
from app.modules.ledger.router import router as ledger_router
from app.modules.media.router import router as media_router
from app.modules.messaging.router import router as messaging_router
from app.modules.notifications.router import router as notifications_router
from app.modules.onboarding.kyc_router import router as kyc_router
from app.modules.payments.router import router as payments_router
from app.modules.ppv.router import router as ppv_router
from app.modules.onboarding.router import router as onboarding_router
from app.modules.onboarding.webhook_router import router as webhook_kyc_router
from app.modules.admin.router import router as admin_router
from app.modules.ai_safety.router import router as ai_safety_router
from app.modules.ai_tools.router import router as ai_tools_promo_router
from app.modules.ai_tools.translation_router import router as ai_tools_translation_router
from app.modules.collections.router import router as collections_router
from app.modules.contact.router import router as contact_router
from app.modules.inbound.router import router as inbound_router
from app.modules.inbound.router import webhook_router as inbound_webhook_router
from app.modules.posts.router import feed_router, router as posts_router

logger = logging.getLogger(__name__)

def create_app() -> FastAPI:
    app = FastAPI(title="Zinovia Fans API")

    settings = get_settings()
    cors_origins = settings.cors_origins_list()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-Request-Id",
            "X-CSRF-Token",
            "X-Idempotency-Key",
            "Idempotency-Key",
            "Cookie",
        ],
    )

    configure_logging(get_request_id)
    from app.modules.billing.ccbill_client import ccbill_configured

    # Startup diagnostics — log critical config (no secrets)
    logger.info(
        "startup config: env=%s cors_origins=%s mail_provider=%s ccbill_configured=%s storage=%s",
        settings.environment,
        settings.cors_origins_list(),
        settings.mail_provider,
        ccbill_configured(),
        settings.storage,
    )

    # --- Paths exempt from CSRF ---
    # Webhooks receive POST from external services; auth endpoints are pre-login
    # and must work even when a stale csrf_token cookie exists from a prior session.
    csrf_exempt_prefixes = (
        "/billing/webhooks/",
        "/webhooks/",
        "/health",
        "/ready",
        "/auth/",
        "/contact",
        "/__e2e__/",
    )

    @app.middleware("http")
    async def security_headers_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(self), microphone=(self), geolocation=()"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response

    @app.middleware("http")
    async def csrf_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Double-submit cookie CSRF protection for state-changing methods."""
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)
        path = request.url.path
        if any(path.startswith(prefix) for prefix in csrf_exempt_prefixes):
            return await call_next(request)
        cookie_token = request.cookies.get("csrf_token")
        header_token = request.headers.get("X-CSRF-Token")
        if cookie_token and header_token and cookie_token == header_token:
            return await call_next(request)
        # Allow requests without any CSRF cookie (e.g., first login, signup)
        # CSRF only enforced when the cookie exists (set after login)
        if not cookie_token:
            return await call_next(request)
        origin = request.headers.get("origin", "")
        csrf_response = JSONResponse(
            status_code=403,
            content={"error": "csrf_validation_failed", "detail": "Missing or mismatched CSRF token"},
        )
        # Include CORS headers so the browser can read the error body
        if origin in cors_origins:
            csrf_response.headers["Access-Control-Allow-Origin"] = origin
            csrf_response.headers["Access-Control-Allow-Credentials"] = "true"
        return csrf_response

    @app.middleware("http")
    async def request_id_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = (
            request.headers.get("X-Request-Id")
            or request.headers.get("X-Amzn-Trace-Id")
            or get_request_id()
        )
        set_request_id(request_id)
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger = logging.getLogger("zinovia.errors")
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"error": "internal_server_error", "request_id": get_request_id()},
        )

    @app.get("/health")
    async def health() -> dict[str, object]:
        return {"ok": True, "status": "ok"}

    @app.get("/ready")
    async def ready() -> dict[str, object]:
        db_ok = await check_db()
        redis_ok = await check_redis()
        ccbill_ok = ccbill_configured()
        status = "ok" if db_ok and redis_ok else "degraded"
        return {
            "status": status,
            "checks": {
                "database": db_ok,
                "redis": redis_ok,
                "ccbill_configured": ccbill_ok,
            },
            "version": settings.git_sha or "dev",
            "environment": settings.environment,
        }

    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(onboarding_router, prefix="/onboarding", tags=["onboarding"])
    app.include_router(kyc_router, prefix="/kyc", tags=["kyc"])
    app.include_router(webhook_kyc_router, prefix="/webhooks", tags=["webhooks"])
    app.include_router(billing_webhook_alias_router)
    app.include_router(creators_router, prefix="/creators", tags=["creators"])
    app.include_router(posts_router, prefix="/posts", tags=["posts"])
    app.include_router(feed_router, tags=["feed"])
    app.include_router(media_router, prefix="/media", tags=["media"])
    app.include_router(ai_router, prefix="/ai/images", tags=["ai"])
    app.include_router(brand_router, prefix="/brand/assets", tags=["brand"])
    app.include_router(future_router)
    app.include_router(messaging_router)
    app.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
    app.include_router(payments_router)
    app.include_router(ppv_router)
    app.include_router(billing_router, prefix="/billing", tags=["billing"])
    app.include_router(creator_earnings_router, prefix="/creator", tags=["creator"])
    app.include_router(ledger_router, prefix="/ledger", tags=["ledger"])
    app.include_router(collections_router, prefix="/collections", tags=["collections"])
    app.include_router(admin_router, prefix="/admin", tags=["admin"])
    app.include_router(inbound_router, prefix="/admin/inbound", tags=["admin-inbound"])
    app.include_router(inbound_webhook_router, prefix="/webhooks", tags=["webhooks"])
    app.include_router(contact_router, tags=["contact"])
    app.include_router(ai_safety_router, prefix="/ai-safety", tags=["ai-safety"])
    app.include_router(ai_tools_promo_router, prefix="/ai-tools", tags=["ai-tools"])
    app.include_router(ai_tools_translation_router, prefix="/ai-tools", tags=["ai-tools"])

    # E2E test-only endpoints — gated by E2E_ENABLE + E2E_SECRET, never in production
    if settings.e2e_enable and not settings.is_production:
        from app.modules.e2e.router import router as e2e_router
        app.include_router(e2e_router)
        logger.info("E2E test endpoints enabled at /__e2e__/*")

    return app


app = create_app()
