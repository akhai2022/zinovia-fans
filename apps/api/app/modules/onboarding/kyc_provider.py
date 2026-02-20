"""KYC provider interface and built-in implementation."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID

from app.core.settings import get_settings


@dataclass
class KycSessionResult:
    redirect_url: str
    provider_session_id: str


class KycProvider(ABC):
    """Interface for KYC providers."""

    @abstractmethod
    async def create_session(
        self, creator_id: UUID, kyc_session_id: UUID, return_url: str | None = None
    ) -> KycSessionResult:
        ...


class BuiltInKycProvider(KycProvider):
    """Built-in KYC: collects age, ID card, and selfie on /kyc/verify."""

    async def create_session(
        self, creator_id: UUID, kyc_session_id: UUID, return_url: str | None = None
    ) -> KycSessionResult:
        settings = get_settings()
        base = (settings.public_web_base_url or settings.app_base_url).rstrip("/")
        provider_session_id = f"kyc_{kyc_session_id}"
        redirect_url = f"{base}/kyc/verify?session_id={kyc_session_id}"
        return KycSessionResult(
            redirect_url=redirect_url,
            provider_session_id=provider_session_id,
        )
