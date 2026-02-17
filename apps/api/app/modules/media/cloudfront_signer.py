"""CloudFront signed URL generation using RSA key pair."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from botocore.signers import CloudFrontSigner
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from app.core.settings import get_settings


def _rsa_signer(message: bytes) -> bytes:
    """Sign message with the CloudFront private key."""
    settings = get_settings()
    pem = settings.cloudfront_private_key_pem
    if not pem:
        raise RuntimeError("CLOUDFRONT_PRIVATE_KEY_PEM is not configured")
    # Support escaped newlines in env vars
    pem_bytes = pem.replace("\\n", "\n").encode("utf-8")
    private_key = serialization.load_pem_private_key(pem_bytes, password=None)
    return private_key.sign(message, padding.PKCS1v15(), hashes.SHA1())  # type: ignore[union-attr]


def generate_signed_url(object_key: str) -> str:
    """Generate a CloudFront signed URL for the given S3 object key."""
    settings = get_settings()
    if not settings.cloudfront_domain or not settings.cloudfront_key_pair_id:
        raise RuntimeError("CloudFront is not configured (CLOUDFRONT_DOMAIN and CLOUDFRONT_KEY_PAIR_ID required)")

    signer = CloudFrontSigner(settings.cloudfront_key_pair_id, _rsa_signer)
    url = f"https://{settings.cloudfront_domain}/{object_key}"
    expires = datetime.now(timezone.utc) + timedelta(seconds=settings.cloudfront_url_ttl_seconds)
    return signer.generate_presigned_url(url, date_less_than=expires)
