from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    environment: Literal["local", "staging", "production", "prod"] = "local"

    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(default="", alias="REDIS_URL")

    # Storage: minio (local) or s3 (AWS ECS). When s3, use S3_BUCKET + IAM role.
    storage: Literal["minio", "s3"] = Field(default="minio", alias="STORAGE")
    s3_bucket: str | None = Field(default=None, alias="S3_BUCKET")
    aws_region: str | None = Field(default=None, alias="AWS_REGION")

    minio_endpoint: str = Field(default="", alias="MINIO_ENDPOINT")
    minio_public_endpoint: str | None = Field(default=None, alias="MINIO_PUBLIC_ENDPOINT")
    minio_access_key: str = Field(default="", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="", alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(default="", alias="MINIO_BUCKET")
    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")

    # CloudFront signed URL delivery (optional; falls back to S3 presigned if not set)
    cloudfront_domain: str | None = Field(default=None, alias="CLOUDFRONT_DOMAIN")
    cloudfront_key_pair_id: str | None = Field(default=None, alias="CLOUDFRONT_KEY_PAIR_ID")
    cloudfront_private_key_pem: str | None = Field(default=None, alias="CLOUDFRONT_PRIVATE_KEY_PEM")
    cloudfront_url_ttl_seconds: int = Field(default=600, alias="CLOUDFRONT_URL_TTL_SECONDS")

    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(default=60, alias="JWT_EXPIRE_MINUTES")

    cookie_secure: bool = Field(default=False, alias="COOKIE_SECURE")
    cookie_samesite: Literal["lax", "strict", "none"] = Field(
        default="lax",
        alias="COOKIE_SAMESITE",
    )
    cookie_domain: str | None = Field(default=None, alias="COOKIE_DOMAIN")
    csrf_secret: str = Field(alias="CSRF_SECRET")

    # CORS: comma-separated origins (localhost:3000 for local dev; include 127.0.0.1 if used)
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ORIGINS",
    )

    # CCBill payment processor
    ccbill_account_number: str = Field(default="", alias="CCBILL_ACCOUNT_NUMBER")
    ccbill_sub_account: str = Field(default="", alias="CCBILL_SUB_ACCOUNT")
    ccbill_flex_form_id: str = Field(default="", alias="CCBILL_FLEX_FORM_ID")
    ccbill_salt: str = Field(default="", alias="CCBILL_SALT")
    ccbill_datalink_username: str = Field(default="", alias="CCBILL_DATALINK_USERNAME")
    ccbill_datalink_password: str = Field(default="", alias="CCBILL_DATALINK_PASSWORD")
    ccbill_test_mode: bool = Field(default=True, alias="CCBILL_TEST_MODE")
    # Webhook test bypass for automated tests (must be off in production)
    ccbill_webhook_test_bypass: bool = Field(default=False, alias="CCBILL_WEBHOOK_TEST_BYPASS")
    checkout_success_url: str = Field(
        default="http://localhost:3000/billing/success",
        alias="CHECKOUT_SUCCESS_URL",
    )
    checkout_cancel_url: str = Field(
        default="http://localhost:3000/billing/cancel",
        alias="CHECKOUT_CANCEL_URL",
    )
    platform_fee_percent: float = Field(default=10, alias="PLATFORM_FEE_PERCENT", ge=0, le=100)
    tip_min_cents: int = Field(default=100, alias="TIP_MIN_CENTS", ge=1)
    tip_max_cents: int = Field(default=10_000_00, alias="TIP_MAX_CENTS", ge=100)  # $10k
    rate_limit_messages_per_min: int = Field(
        default=30, alias="RATE_LIMIT_MESSAGES_PER_MIN", ge=1
    )
    rate_limit_payments_per_min: int = Field(
        default=10, alias="RATE_LIMIT_PAYMENTS_PER_MIN", ge=1
    )
    rate_limit_likes_per_min: int = Field(
        default=60, alias="RATE_LIMIT_LIKES_PER_MIN", ge=1
    )
    rate_limit_comments_per_min: int = Field(
        default=30, alias="RATE_LIMIT_COMMENTS_PER_MIN", ge=1
    )
    message_max_length: int = Field(default=2000, alias="MESSAGE_MAX_LENGTH", ge=1)
    media_url_ttl_seconds: int = Field(default=900, alias="MEDIA_URL_TTL_SECONDS")
    rate_limit_max: int = Field(default=10, alias="RATE_LIMIT_MAX")
    rate_limit_window_seconds: int = Field(default=60, alias="RATE_LIMIT_WINDOW_SECONDS")

    # Image upload max size (bytes). Video has separate media_max_video_bytes.
    media_max_image_bytes: int = Field(
        default=26_214_400,  # 25 MiB
        ge=1,
        alias="MEDIA_MAX_IMAGE_BYTES",
    )

    # Creator onboarding (Feature 1)
    kyc_webhook_hmac_secret: str = Field(
        alias="KYC_WEBHOOK_HMAC_SECRET",
        default="dev-secret-change-in-prod",
    )
    app_base_url: str = Field(alias="APP_BASE_URL", default="http://localhost:3000")
    api_base_url: str = Field(alias="API_BASE_URL", default="http://localhost:8000")
    public_web_base_url: str = Field(
        alias="PUBLIC_WEB_BASE_URL", default="http://localhost:3000"
    )
    mail_provider: Literal["console", "resend", "mailpit"] = Field(
        alias="MAIL_PROVIDER", default="console"
    )
    mailpit_host: str = Field(default="localhost", alias="MAILPIT_HOST")
    mailpit_port: int = Field(default=1025, alias="MAILPIT_PORT")
    # Default matches production sender; can be overridden via MAIL_FROM env var.
    mail_from: str = Field(alias="MAIL_FROM", default="noreply@zinovia.ai")
    mail_reply_to: str = Field(alias="MAIL_REPLY_TO", default="support@zinovia.ai")
    mail_dry_run: bool = Field(alias="MAIL_DRY_RUN", default=False)
    resend_api_key: str = Field(alias="RESEND_API_KEY", default="")

    # Watermark for derived image variants (footer only; originals unchanged)
    media_watermark_text: str = Field(
        default="Published on Zinovia-Fans",
        alias="MEDIA_WATERMARK_TEXT",
    )
    media_watermark_enabled: bool = Field(
        default=False,
        alias="MEDIA_WATERMARK_ENABLED",
    )
    media_watermark_variants: str = Field(
        default="grid,full",
        alias="MEDIA_WATERMARK_VARIANTS",
    )
    media_watermark_height_pct: float = Field(
        default=0.08,
        ge=0.05,
        le=0.12,
        alias="MEDIA_WATERMARK_HEIGHT_PCT",
    )
    media_watermark_opacity: float = Field(
        default=0.55,
        ge=0.0,
        le=1.0,
        alias="MEDIA_WATERMARK_OPACITY",
    )
    media_watermark_bg: bool = Field(
        default=True,
        alias="MEDIA_WATERMARK_BG",
    )
    media_watermark_padding_pct: float = Field(
        default=0.04,
        ge=0.0,
        le=0.2,
        alias="MEDIA_WATERMARK_PADDING_PCT",
    )
    media_watermark_text_align: str = Field(
        default="left",
        alias="MEDIA_WATERMARK_TEXT_ALIGN",
    )
    media_watermark_include_handle: bool = Field(
        default=False,
        alias="MEDIA_WATERMARK_INCLUDE_HANDLE",
    )

    # Video (MVP: MP4 only, no transcoding)
    media_allow_video: bool = Field(default=True, alias="MEDIA_ALLOW_VIDEO")
    media_max_video_bytes: int = Field(
        default=200_000_000,
        ge=1,
        alias="MEDIA_MAX_VIDEO_BYTES",
    )
    media_video_poster_enabled: bool = Field(
        default=True,
        alias="MEDIA_VIDEO_POSTER_ENABLED",
    )
    media_video_poster_time_sec: float = Field(
        default=1.0,
        ge=0.0,
        alias="MEDIA_VIDEO_POSTER_TIME_SEC",
    )
    media_video_poster_max_width: int = Field(
        default=640,
        ge=1,
        le=2048,
        alias="MEDIA_VIDEO_POSTER_MAX_WIDTH",
    )

    # AI image generation
    ai_provider: Literal["mock", "replicate"] = Field(
        default="mock", alias="AI_PROVIDER"
    )
    replicate_api_token: str = Field(default="", alias="REPLICATE_API_TOKEN")
    # AI image: temporary MVP gate for non-admin to apply to landing.hero
    allow_brand_asset_write: bool = Field(
        default=False,
        alias="ALLOW_BRAND_ASSET_WRITE",
    )
    enable_likes: bool = Field(default=False, alias="ENABLE_LIKES")
    enable_comments: bool = Field(default=False, alias="ENABLE_COMMENTS")
    enable_notifications: bool = Field(default=False, alias="ENABLE_NOTIFICATIONS")
    enable_vault: bool = Field(default=True, alias="ENABLE_VAULT")
    enable_scheduled_posts: bool = Field(default=False, alias="ENABLE_SCHEDULED_POSTS")
    enable_promotions: bool = Field(default=False, alias="ENABLE_PROMOTIONS")
    enable_dm_broadcast: bool = Field(default=False, alias="ENABLE_DM_BROADCAST")
    enable_ppv_posts: bool = Field(default=False, alias="ENABLE_PPV_POSTS")
    enable_ppvm: bool = Field(default=False, alias="ENABLE_PPVM")
    enable_moderation: bool = Field(default=False, alias="ENABLE_MODERATION")
    enable_analytics: bool = Field(default=False, alias="ENABLE_ANALYTICS")
    enable_mobile_nav_polish: bool = Field(default=False, alias="ENABLE_MOBILE_NAV_POLISH")
    # Allow mock KYC provider in production (temporary; disable once real provider integrated).
    enable_mock_kyc: bool = Field(default=False, alias="ENABLE_MOCK_KYC")
    default_currency: str = Field(default="eur", alias="DEFAULT_CURRENCY")

    # E2E testing: enable test-only endpoints (MUST be off in production)
    e2e_enable: bool = Field(default=False, alias="E2E_ENABLE")
    e2e_secret: str = Field(default="", alias="E2E_SECRET")

    # Observability
    sentry_dsn: str = Field(default="", alias="SENTRY_DSN")
    sentry_traces_sample_rate: float = Field(default=0.1, alias="SENTRY_TRACES_SAMPLE_RATE")
    git_sha: str = Field(default="", alias="GIT_SHA")
    min_ppv_cents: int = Field(default=100, alias="MIN_PPV_CENTS", ge=1)
    max_ppv_cents: int = Field(default=20000, alias="MAX_PPV_CENTS", ge=1)
    ppv_intent_rate_limit_per_min: int = Field(
        default=10,
        alias="PPV_INTENT_RATE_LIMIT_PER_MIN",
        ge=1,
    )

    # Subscription price bounds (cents). Creators choose within this range.
    min_subscription_price_cents: int = Field(
        default=299, alias="MIN_SUBSCRIPTION_PRICE_CENTS", ge=100
    )
    max_subscription_price_cents: int = Field(
        default=49999, alias="MAX_SUBSCRIPTION_PRICE_CENTS", ge=100
    )

    # Minimum password length for both signup and reset (single source of truth).
    password_min_length: int = Field(default=10, alias="PASSWORD_MIN_LENGTH", ge=8)

    # Subscription grace period for past_due status (hours).
    subscription_grace_period_hours: int = Field(
        default=72, alias="SUBSCRIPTION_GRACE_PERIOD_HOURS", ge=0
    )

    @model_validator(mode="after")
    def validate_storage_config(self) -> Settings:
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("COOKIE_SECURE must be true when COOKIE_SAMESITE=none")
        if self.storage == "s3":
            if not self.s3_bucket:
                raise ValueError("S3_BUCKET is required when STORAGE=s3")
        else:  # minio
            required = (
                self.minio_endpoint,
                self.minio_access_key,
                self.minio_secret_key,
                self.minio_bucket,
            )
            if not all(required):
                raise ValueError(
                    "MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, "
                    "MINIO_BUCKET are required when STORAGE=minio"
                )
        # Production safety: email provider must be resend
        if self.is_production and self.mail_provider in ("console", "mailpit"):
            raise ValueError(
                f"MAIL_PROVIDER={self.mail_provider} is not allowed in production. Use 'resend'."
            )
        # Production safety: MAIL_FROM must use @zinovia.ai domain
        if self.is_production and not self.mail_from.endswith("@zinovia.ai"):
            raise ValueError(
                f"MAIL_FROM must use @zinovia.ai domain in production, got: {self.mail_from}"
            )
        # Production safety: E2E endpoints must be off
        if self.is_production and self.e2e_enable:
            raise ValueError(
                "E2E_ENABLE must be false in production."
            )
        # Production safety: webhook test bypass must be off
        if self.is_production and self.ccbill_webhook_test_bypass:
            raise ValueError(
                "CCBILL_WEBHOOK_TEST_BYPASS must be false in production."
            )
        # Production safety: cookie must be secure
        if self.is_production and not self.cookie_secure:
            raise ValueError(
                "COOKIE_SECURE must be true in production."
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.environment in ("production", "prod")

    def media_watermark_variant_list(self) -> list[str]:
        return [v.strip() for v in self.media_watermark_variants.split(",") if v.strip()]

    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
