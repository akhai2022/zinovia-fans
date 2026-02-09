from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import timedelta
from urllib.parse import urlparse, urlunparse

from minio import Minio

from app.core.settings import get_settings


class StorageClient(ABC):
    @abstractmethod
    def create_signed_upload_url(self, object_key: str, content_type: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def create_signed_download_url(self, object_key: str) -> str:
        raise NotImplementedError


def _rewrite_url_host(url: str, public_endpoint: str) -> str:
    """Replace host in URL with public_endpoint (e.g. localhost:9000 for host-reachable presigned URLs)."""
    parsed = urlparse(url)
    return urlunparse((parsed.scheme, public_endpoint, parsed.path, parsed.params, parsed.query, parsed.fragment))


class MinioStorage(StorageClient):
    def __init__(self) -> None:
        settings = get_settings()
        self._bucket = settings.minio_bucket
        self._public_endpoint = settings.minio_public_endpoint
        self._client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self._ttl = timedelta(seconds=settings.media_url_ttl_seconds)

    def create_signed_upload_url(self, object_key: str, content_type: str) -> str:
        url = self._client.presigned_put_object(
            self._bucket,
            object_key,
            expires=self._ttl,
        )
        # Do not rewrite upload URL: presigned PUT is validated by MinIO using Host header;
        # rewriting would cause 403 when client sends Host different from signed host.
        return url

    def create_signed_download_url(self, object_key: str) -> str:
        url = self._client.presigned_get_object(self._bucket, object_key, expires=self._ttl)
        if self._public_endpoint:
            return _rewrite_url_host(url, self._public_endpoint)
        return url


class GcsStorage(StorageClient):
    def create_signed_upload_url(self, object_key: str, content_type: str) -> str:
        raise NotImplementedError("GCS storage is not configured in local mode.")

    def create_signed_download_url(self, object_key: str) -> str:
        raise NotImplementedError("GCS storage is not configured in local mode.")


def get_storage_client() -> StorageClient:
    settings = get_settings()
    if settings.is_production:
        return GcsStorage()
    return MinioStorage()
