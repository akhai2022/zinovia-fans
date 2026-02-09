from __future__ import annotations

import logging
import sys
from typing import Any

from pythonjsonlogger import jsonlogger


class RequestIdFilter(logging.Filter):
    def __init__(self, request_id_getter) -> None:
        super().__init__()
        self._request_id_getter = request_id_getter

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = self._request_id_getter()
        return True


def configure_logging(request_id_getter) -> None:
    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s"
    )
    handler.setFormatter(formatter)
    handler.addFilter(RequestIdFilter(request_id_getter))

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers = [handler]


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
