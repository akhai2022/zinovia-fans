"""Translation Celery task — translate captions using argostranslate (CPU-only)."""

from __future__ import annotations

import asyncio
import logging
import uuid

from celery import shared_task
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.settings import get_settings
from app.modules.ai_tools.translation_models import PostTranslation

logger = logging.getLogger(__name__)

# Supported language pairs (en → target)
SUPPORTED_PAIRS = {"fr", "es", "ar"}

# Lock to ensure thread-safe argos model loading
_argos_installed = False


def _ensure_argos_packages() -> None:
    """Ensure argostranslate language packages are installed (idempotent)."""
    global _argos_installed
    if _argos_installed:
        return

    try:
        import argostranslate.package

        argostranslate.package.update_package_index()
        installed = {
            (p.from_code, p.to_code)
            for p in argostranslate.package.get_installed_packages()
        }

        for lang in SUPPORTED_PAIRS:
            if ("en", lang) not in installed:
                available = argostranslate.package.get_available_packages()
                pkg = next(
                    (p for p in available if p.from_code == "en" and p.to_code == lang),
                    None,
                )
                if pkg:
                    logger.info("Installing argos package en→%s", lang)
                    argostranslate.package.install_from_path(pkg.download())
                else:
                    logger.warning("Argos package en→%s not available", lang)

        _argos_installed = True
    except Exception:
        logger.exception("Failed to ensure argos packages")


def _translate_text(text: str, source_lang: str, target_lang: str) -> str:
    """Translate text using argostranslate."""
    import argostranslate.translate

    _ensure_argos_packages()
    return argostranslate.translate.translate(text, source_lang, target_lang)


def _make_session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine(str(get_settings().database_url), pool_pre_ping=True)
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def _update_translation(
    translation_id: uuid.UUID, translated_text: str | None, status: str
) -> None:
    async with _make_session_factory()() as session:
        await session.execute(
            update(PostTranslation)
            .where(PostTranslation.id == translation_id)
            .values(translated_text=translated_text, status=status)
        )
        await session.commit()


async def _get_translation_status(translation_id: uuid.UUID) -> str | None:
    from sqlalchemy import select

    async with _make_session_factory()() as session:
        r = await session.execute(
            select(PostTranslation.status)
            .where(PostTranslation.id == translation_id)
            .limit(1)
        )
        return r.scalar_one_or_none()


@shared_task(
    name="translation.translate_caption",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    acks_late=True,
)
def translate_caption(
    self,
    translation_id: str,
    source_text: str,
    source_lang: str,
    target_lang: str,
) -> dict:
    """Translate a caption and store the result in the DB.

    Idempotent: skips if translation already completed.
    """
    try:
        tid = uuid.UUID(translation_id)
    except ValueError:
        logger.warning("Invalid translation_id: %s", translation_id)
        return {"status": "error", "detail": "invalid_id"}

    if target_lang not in SUPPORTED_PAIRS:
        asyncio.run(_update_translation(tid, None, "failed"))
        return {"status": "error", "detail": f"unsupported_language: {target_lang}"}

    # Idempotent check
    current_status = asyncio.run(_get_translation_status(tid))
    if current_status == "completed":
        logger.info("Translation already completed, skipping: %s", translation_id)
        return {"status": "skipped"}

    try:
        # Limit input to prevent excessive CPU usage
        truncated = source_text[:2000]
        translated = _translate_text(truncated, source_lang, target_lang)
        asyncio.run(_update_translation(tid, translated, "completed"))
        logger.info(
            "Translation completed: %s (%s→%s)",
            translation_id, source_lang, target_lang,
        )
        return {"status": "completed", "target_lang": target_lang}
    except Exception as exc:
        logger.exception("Translation failed: %s", translation_id)
        asyncio.run(_update_translation(tid, None, "failed"))
        raise self.retry(exc=exc)
