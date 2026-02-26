"""IBAN and BIC validation utilities."""

from __future__ import annotations

import re

# ISO 3166-1 alpha-2 SEPA countries (EU/EEA + UK, CH, MC, SM, VA, AD, LI)
SEPA_COUNTRIES = {
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
    "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
    "SI", "ES", "SE", "GB", "CH", "MC", "SM", "VA", "AD", "LI", "IS", "NO",
}

# IBAN length by country (ISO 13616)
IBAN_LENGTHS: dict[str, int] = {
    "AD": 24, "AT": 20, "BE": 16, "BG": 22, "CH": 21, "CY": 28, "CZ": 24,
    "DE": 22, "DK": 18, "EE": 20, "ES": 24, "FI": 18, "FR": 27, "GB": 22,
    "GR": 27, "HR": 21, "HU": 28, "IE": 22, "IS": 26, "IT": 27, "LI": 21,
    "LT": 20, "LU": 20, "LV": 21, "MC": 27, "MT": 31, "NL": 18, "NO": 15,
    "PL": 28, "PT": 25, "RO": 24, "SE": 24, "SI": 19, "SK": 24, "SM": 27,
    "VA": 22,
}

_IBAN_RE = re.compile(r"^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$")
_BIC_RE = re.compile(r"^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$")


def _iban_mod97(iban: str) -> int:
    """ISO 7064 Mod 97-10 check for IBAN."""
    # Move first 4 chars to end
    rearranged = iban[4:] + iban[:4]
    # Replace letters A=10 ... Z=35
    numeric = ""
    for ch in rearranged:
        if ch.isdigit():
            numeric += ch
        else:
            numeric += str(ord(ch) - ord("A") + 10)
    return int(numeric) % 97


def validate_iban(iban: str) -> str:
    """Validate IBAN format and checksum. Returns normalized (uppercase, no spaces) IBAN or raises ValueError."""
    cleaned = iban.upper().replace(" ", "").replace("-", "")

    if not _IBAN_RE.match(cleaned):
        raise ValueError("Invalid IBAN format")

    country = cleaned[:2]
    if country not in SEPA_COUNTRIES:
        raise ValueError(f"IBAN country {country} is not a SEPA country")

    expected_len = IBAN_LENGTHS.get(country)
    if expected_len and len(cleaned) != expected_len:
        raise ValueError(f"IBAN for {country} must be {expected_len} characters, got {len(cleaned)}")

    if _iban_mod97(cleaned) != 1:
        raise ValueError("IBAN checksum invalid")

    return cleaned


def validate_bic(bic: str) -> str:
    """Validate BIC/SWIFT format. Returns normalized uppercase BIC or raises ValueError."""
    cleaned = bic.upper().replace(" ", "")

    if not _BIC_RE.match(cleaned):
        raise ValueError("Invalid BIC/SWIFT format")

    return cleaned


def iban_last4(iban: str) -> str:
    """Return last 4 characters of a normalized IBAN for display."""
    return iban[-4:]
