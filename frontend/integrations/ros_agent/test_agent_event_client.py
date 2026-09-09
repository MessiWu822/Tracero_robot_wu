import json
import unittest
from unittest.mock import patch

from agent_event_client import AgentEvent, TraceroEventClient


class FakeResponse:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return b'{"run_id":"run-agent","status":"received"}'


class TraceroEventClientTests(unittest.TestCase):
    @patch("agent_event_client.urllib.request.urlopen", return_value=FakeResponse())
    def test_publish_posts_the_agent_contract(self, urlopen):
        event = AgentEvent(
            event_id="event-001",
            event_type="navigation_stuck",
            trigger_time=1_787_318_400,
            robot_id="robot_001",
            window={
                "before": [
                    {
                        "topic": "/cmd_vel",
                        "timestamp": 1_787_318_399,
                        "data": {"linear_x": 0.0},
                    }
                ]
            },
        )

        result = TraceroEventClient("http://127.0.0.1").publish(event)

        request = urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(request.full_url, "http://127.0.0.1/api/ingest/event")
        self.assertEqual(payload["event_id"], "event-001")
        self.assertEqual(payload["event_type"], "navigation_stuck")
        self.assertEqual(result["run_id"], "run-agent")

    def test_rejects_unknown_event_types_before_network_io(self):
        event = AgentEvent(
            event_type="unknown",
            trigger_time=1,
            robot_id="robot_001",
            window={"before": [{"topic": "/scan"}]},
        )

        with self.assertRaisesRegex(ValueError, "Unsupported"):
            TraceroEventClient().publish(event)


if __name__ == "__main__":
    unittest.main()
