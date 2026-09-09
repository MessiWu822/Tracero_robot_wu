"""Reliable client used by a ROS Agent to push anomaly events to Tracero."""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any

LOGGER = logging.getLogger("tracero-agent")
DEFAULT_BACKEND_URL = os.getenv("TRACERO_BACKEND_URL", "http://127.0.0.1")
SUPPORTED_EVENT_TYPES = {
    "navigation_failed",
    "navigation_stuck",
    "obstacle_near",
}


@dataclass(frozen=True)
class AgentEvent:
    event_type: str
    trigger_time: float
    robot_id: str
    window: dict[str, list[dict[str, Any]]]
    params_snapshot: dict[str, Any] = field(default_factory=dict)
    static_index_version: str | None = None
    event_id: str = field(default_factory=lambda: f"event-{uuid.uuid4().hex}")

    def payload(self) -> dict[str, Any]:
        if self.event_type not in SUPPORTED_EVENT_TYPES:
            raise ValueError(f"Unsupported Agent event type: {self.event_type}")
        if not self.robot_id.strip():
            raise ValueError("robot_id must not be empty")
        if not self.window:
            raise ValueError("window must contain runtime evidence")
        return asdict(self)


class TraceroEventClient:
    """Push events without blocking forever when the backend is unavailable."""

    def __init__(
        self,
        backend_url: str = DEFAULT_BACKEND_URL,
        *,
        timeout_seconds: float = 10.0,
        max_attempts: int = 4,
    ) -> None:
        self._url = f"{backend_url.rstrip('/')}/api/ingest/event"
        self._timeout_seconds = timeout_seconds
        self._max_attempts = max(1, max_attempts)

    def publish(self, event: AgentEvent) -> dict[str, Any]:
        body = json.dumps(event.payload(), ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            self._url,
            data=body,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-Tracero-Event-Id": event.event_id,
            },
            method="POST",
        )

        last_error: Exception | None = None
        for attempt in range(1, self._max_attempts + 1):
            try:
                with urllib.request.urlopen(
                    request, timeout=self._timeout_seconds
                ) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                    LOGGER.info(
                        "POST /api/ingest/event succeeded: HTTP %s run_id=%s",
                        response.status,
                        payload.get("run_id"),
                    )
                    return payload
            except urllib.error.HTTPError as error:
                response_body = error.read().decode("utf-8", errors="replace")
                last_error = RuntimeError(
                    f"HTTP {error.code}: {response_body or error.reason}"
                )
                if 400 <= error.code < 500:
                    break
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
                last_error = error

            if attempt < self._max_attempts:
                delay_seconds = min(2 ** (attempt - 1), 8)
                LOGGER.warning(
                    "Agent event push failed (%s/%s): %s; retrying in %ss",
                    attempt,
                    self._max_attempts,
                    last_error,
                    delay_seconds,
                )
                time.sleep(delay_seconds)

        raise RuntimeError(
            f"POST {self._url} failed after {self._max_attempts} attempts: "
            f"{last_error}"
        )
