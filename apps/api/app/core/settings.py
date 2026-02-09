from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["local", "staging", "production"] = "local"

    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")

    minio_endpoint: str = Field(alias="MINIO_ENDPOINT")
    minio_public_endpoint: str | None = Field(default=None, alias="MINIO_PUBLIC_ENDPOINT")
    minio_access_key: str = Field(alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(alias="MINIO_BUCKET")
    minio_secure: bool = Field(alias="MINIO_SECURE")

    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = Field(alias="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(alias="JWT_EXPIRE_MINUTES")

    cookie_secure: bool = Field(alias="COOKIE_SECURE")
    csrf_secret: str = Field(alias="CSRF_SECRET")

    # CORS: comma-separated origins (e.g. http://localhost:3000 for local dev; include 127.0.0.1 if used)
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ORIGINS",
    )

    stripe_secret_key: str = Field(default="sk_test_placeholder", alias="STRIPE_SECRET_KEY")
    stripe_webhook_secret: str = Field(default="", alias="STRIPE_WEBHOOK_SECRET")
    stripe_webhook_test_bypass: bool = Field(default=False, alias="STRIPE_WEBHOOK_TEST_BYPASS")
    checkout_success_url: str = Field(
        default="http://localhost:3000/billing/success",
        alias="CHECKOUT_SUCCESS_URL",
    )
    checkout_cancel_url: str = Field(
        default="http://localhost:3000/billing/cancel",
        alias="CHECKOUT_CANCEL_URL",
    )
    platform_fee_percent: float = Field(default=10, alias="PLATFORM_FEE_PERCENT", ge=0, le=100)
    media_url_ttl_seconds: int = Field(alias="MEDIA_URL_TTL_SECONDS")
    rate_limit_max: int = Field(alias="RATE_LIMIT_MAX")
    rate_limit_window_seconds: int = Field(alias="RATE_LIMIT_WINDOW_SECONDS")

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

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def media_watermark_variant_list(self) -> list[str]:
        return [v.strip() for v in self.media_watermark_variants.split(",") if v.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
