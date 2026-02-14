"""Onboarding state machine constants."""

from __future__ import annotations

CREATED = "CREATED"
EMAIL_VERIFIED = "EMAIL_VERIFIED"
KYC_PENDING = "KYC_PENDING"
KYC_SUBMITTED = "KYC_SUBMITTED"
KYC_APPROVED = "KYC_APPROVED"
KYC_REJECTED = "KYC_REJECTED"

VALID_STATES = frozenset({
    CREATED,
    EMAIL_VERIFIED,
    KYC_PENDING,
    KYC_SUBMITTED,
    KYC_APPROVED,
    KYC_REJECTED,
})

# Allowed transitions: from_state -> {to_states}
ALLOWED_TRANSITIONS: dict[str | None, frozenset[str]] = {
    CREATED: frozenset({EMAIL_VERIFIED}),
    EMAIL_VERIFIED: frozenset({KYC_PENDING}),
    KYC_PENDING: frozenset({KYC_SUBMITTED}),
    KYC_SUBMITTED: frozenset({KYC_APPROVED, KYC_REJECTED}),
    KYC_APPROVED: frozenset(),
    KYC_REJECTED: frozenset({KYC_PENDING}),  # Allow retry
}
# None = initial creation (no from_state)
ALLOWED_TRANSITIONS[None] = frozenset({CREATED})
