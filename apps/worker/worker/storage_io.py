"""Get/put object bytes for worker (MinIO). Uses same env as API (MINIO_*)."""

from __future__ import annotations

from io import BytesIO

from minio import Minio

from app.core.settings import get_settings


def get_minio_client() -> Minio:
    s = get_settings()
    return Minio(
        s.minio_endpoint,
        access_key=s.minio_access_key,
        secret_key=s.minio_secret_key,
        secure=s.minio_secure,
    )


def get_object_bytes(bucket: str, object_key: str) -> bytes:
    client = get_minio_client()
    resp = client.get_object(bucket, object_key)
    try:
        return resp.read()
    finally:
        resp.close()


def put_object_bytes(bucket: str, object_key: str, data: bytes, content_type: str) -> None:
    client = get_minio_client()
    client.put_object(bucket, object_key, BytesIO(data), len(data), content_type=content_type)
