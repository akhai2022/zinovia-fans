"""Standardized error handling for the API.

All API errors follow a consistent contract:
{
    "code": "error_code_string",
    "message": "Human-friendly message",
    "field_errors": {"field_name": ["error1", "error2"]},  // optional
    "request_id": "correlation-id"
}
"""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.core.request_id import get_request_id


# Human-friendly messages for well-known error codes
ERROR_MESSAGES: dict[str, str] = {
    "invalid_credentials": "Incorrect email or password.",
    "missing_token": "Authentication required. Please sign in.",
    "invalid_token": "Your session has expired. Please sign in again.",
    "inactive_user": "This account has been deactivated.",
    "rate_limited": "Too many attempts. Please wait a moment and try again.",
    "rate_limit_exceeded": "Too many requests. Please slow down.",
    "email_already_registered": "An account with this email already exists.",
    "email_not_verified": "Please verify your email before signing in.",
    "handle_taken": "That handle is already taken.",
    "handle_length_invalid": "Handle must be between 2 and 64 characters.",
    "handle_format_invalid": "Handle can only use letters, numbers, hyphens and underscores.",
    "handle_reserved": "That handle is reserved.",
    "creator_not_found": "Creator not found.",
    "profile_not_found": "Profile not found.",
    "post_not_found": "Post not found.",
    "comment_not_found": "Comment not found.",
    "media_not_owned_or_missing": "Media file not found or not owned by you.",
    "insufficient_role": "You don't have permission to perform this action.",
    "feature_disabled": "This feature is not available yet.",
    "invalid_or_expired_token": "This link is invalid or has expired.",
    "invalid_or_expired_reset_token": "This reset link is invalid or has expired.",
    "invalid_signature": "Invalid webhook signature.",
    "no_stripe_customer": "No billing account found. Subscribe to a creator first.",
    "cannot_follow_self": "You cannot follow yourself.",
    "media_in_use": "This media is used in a post, profile, or collection. Remove it first.",
    "internal_server_error": "Something went wrong. Please try again or contact support.",
}


class AppError(HTTPException):
    """Application error with standardized response format."""

    def __init__(
        self,
        status_code: int,
        detail: str | dict[str, Any],
        *,
        field_errors: dict[str, list[str]] | None = None,
    ) -> None:
        # Build standardized error body
        if isinstance(detail, str):
            code = detail
            message = ERROR_MESSAGES.get(code, code)
            body: dict[str, Any] = {
                "code": code,
                "message": message,
                "request_id": get_request_id(),
            }
            if field_errors:
                body["field_errors"] = field_errors
            super().__init__(status_code=status_code, detail=body)
        else:
            # Fallback for dict-based detail (backwards compat)
            if "request_id" not in detail:
                detail["request_id"] = get_request_id()
            super().__init__(status_code=status_code, detail=detail)
