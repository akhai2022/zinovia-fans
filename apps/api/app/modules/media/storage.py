from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import timedelta
from urllib.parse import urlparse, urlunparse

import boto3
from botocore.config import Config
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
        return str(url)

    def create_signed_download_url(self, object_key: str) -> str:
        url = self._client.presigned_get_object(self._bucket, object_key, expires=self._ttl)
        if self._public_endpoint:
            return _rewrite_url_host(str(url), self._public_endpoint)
        return str(url)


class S3Storage(StorageClient):
    """S3 storage using boto3 and IAM task role (default credential chain). No static keys."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.s3_bucket:
            raise ValueError("S3_BUCKET is required for S3Storage")
        self._bucket = settings.s3_bucket
        self._expires = settings.media_url_ttl_seconds
        self._region = settings.aws_region or "us-east-1"
        config = Config(signature_version="s3v4", s3={"addressing_style": "virtual"})
        self._client = boto3.client("s3", region_name=self._region, config=config)

    def create_signed_upload_url(self, object_key: str, content_type: str) -> str:
        """Generate presigned PUT URL with Content-Type condition enforcement."""
        return str(self._client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self._bucket,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=self._expires,
        ))

    def create_signed_download_url(self, object_key: str) -> str:
        return str(self._client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self._bucket,
                "Key": object_key,
            },
            ExpiresIn=self._expires,
        ))


def get_storage_client() -> StorageClient:
    """Select storage by STORAGE env or S3_BUCKET presence. S3 for AWS ECS; MinIO for local."""
    settings = get_settings()
    if settings.storage == "s3" or settings.s3_bucket:
        return S3Storage()
    return MinioStorage()
