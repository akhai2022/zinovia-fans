"""Get/put object bytes for worker. Supports MinIO (local) and S3 (AWS) via STORAGE env."""

from __future__ import annotations

from io import BytesIO

import boto3
from minio import Minio

from app.core.settings import get_settings


def _use_s3() -> bool:
    settings = get_settings()
    return settings.storage == "s3" or bool(settings.s3_bucket)


def get_media_bucket() -> str:
    """Return media bucket name for current storage backend."""
    settings = get_settings()
    if _use_s3():
        if not settings.s3_bucket:
            raise ValueError("S3_BUCKET is required when STORAGE=s3")
        return settings.s3_bucket
    return settings.minio_bucket


def get_object_bytes(bucket: str, object_key: str) -> bytes:
    if _use_s3():
        client = boto3.client("s3", region_name=get_settings().aws_region or "us-east-1")
        resp = client.get_object(Bucket=bucket, Key=object_key)
        return resp["Body"].read()
    client = Minio(
        get_settings().minio_endpoint,
        access_key=get_settings().minio_access_key,
        secret_key=get_settings().minio_secret_key,
        secure=get_settings().minio_secure,
    )
    resp = client.get_object(bucket, object_key)
    try:
        return resp.read()
    finally:
        resp.close()


def put_object_bytes(bucket: str, object_key: str, data: bytes, content_type: str) -> None:
    if _use_s3():
        client = boto3.client("s3", region_name=get_settings().aws_region or "us-east-1")
        client.put_object(
            Bucket=bucket,
            Key=object_key,
            Body=data,
            ContentType=content_type,
        )
        return
    client = Minio(
        get_settings().minio_endpoint,
        access_key=get_settings().minio_access_key,
        secret_key=get_settings().minio_secret_key,
        secure=get_settings().minio_secure,
    )
    client.put_object(bucket, object_key, BytesIO(data), len(data), content_type=content_type)
