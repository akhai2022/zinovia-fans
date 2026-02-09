from __future__ import annotations

import contextvars
import uuid

_request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default=""
)


def set_request_id(request_id: str) -> None:
    _request_id_var.set(request_id)


def get_request_id() -> str:
    request_id = _request_id_var.get()
    if request_id:
        return request_id
    return str(uuid.uuid4())
