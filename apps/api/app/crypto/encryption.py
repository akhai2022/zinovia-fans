"""AES-256-GCM encryption for sensitive data (IBAN, BIC).

Format: base64(iv:16 || ciphertext || tag:16)
Env var: PAYOUTS_ENCRYPTION_KEY_B64 — 32 bytes base64-encoded.
"""

from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _get_key() -> bytes:
    """Load 32-byte AES key from env (base64-encoded)."""
    raw = os.environ.get("PAYOUTS_ENCRYPTION_KEY_B64", "")
    if not raw:
        raise RuntimeError("PAYOUTS_ENCRYPTION_KEY_B64 not set")
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise RuntimeError("PAYOUTS_ENCRYPTION_KEY_B64 must decode to exactly 32 bytes")
    return key


def encrypt(plaintext: str) -> str:
    """Encrypt a UTF-8 string → base64 blob (iv + ciphertext + tag)."""
    key = _get_key()
    iv = os.urandom(12)  # 96-bit IV for GCM
    aesgcm = AESGCM(key)
    ct = aesgcm.encrypt(iv, plaintext.encode(), None)  # ct includes 16-byte tag
    return base64.b64encode(iv + ct).decode()


def decrypt(token: str) -> str:
    """Decrypt a base64 blob back to UTF-8 string."""
    key = _get_key()
    raw = base64.b64decode(token)
    iv = raw[:12]
    ct = raw[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(iv, ct, None).decode()
