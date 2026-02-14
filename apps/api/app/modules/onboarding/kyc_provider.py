"""KYC provider interface and Mock implementation for staging/local."""

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
    """Interface for KYC providers. Feature 2 can plug in real vendor."""

    @abstractmethod
    async def create_session(
        self, creator_id: UUID, kyc_session_id: UUID, return_url: str | None = None
    ) -> KycSessionResult:
        ...


class MockKycProvider(KycProvider):
    """Staging/local: redirects to mock-kyc page for simulation."""

    async def create_session(
        self, creator_id: UUID, kyc_session_id: UUID, return_url: str | None = None
    ) -> KycSessionResult:
        settings = get_settings()
        provider_session_id = f"mock_{kyc_session_id}"
        redirect_url = f"{settings.app_base_url}/mock-kyc?session_id={kyc_session_id}"
        return KycSessionResult(
            redirect_url=redirect_url,
            provider_session_id=provider_session_id,
        )
