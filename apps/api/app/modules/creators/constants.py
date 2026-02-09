from __future__ import annotations

import re

CREATOR_ROLE = "creator"

HANDLE_MIN_LENGTH = 2
HANDLE_MAX_LENGTH = 64
HANDLE_REGEX = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$")

RESERVED_HANDLES = frozenset(
    {
        "admin",
        "support",
        "billing",
        "api",
        "help",
        "about",
        "terms",
        "privacy",
        "login",
        "signup",
        "logout",
        "me",
        "creators",
        "settings",
        "health",
        "ready",
    }
)

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
