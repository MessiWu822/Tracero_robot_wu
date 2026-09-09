# ROS Agent event push

The robot-side Agent should call `TraceroEventClient.publish` from its anomaly
handler. It posts to `/api/ingest/event` and retries transient failures.

```bash
export TRACERO_BACKEND_URL=http://127.0.0.1
```

```python
import time
from agent_event_client import AgentEvent, TraceroEventClient

client = TraceroEventClient()

def on_navigation_stuck(before_frames, after_frames, params):
    return client.publish(
        AgentEvent(
            event_type="navigation_stuck",
            trigger_time=time.time(),
            robot_id="robot_001",
            window={"before": before_frames, "after": after_frames},
            params_snapshot=params,
        )
    )
```

Frames should contain `topic`, `timestamp`, and `data`. Supported event types:
`navigation_failed`, `navigation_stuck`, and `obstacle_near`.

FastAPI returns `run_id` with `status: received`, builds evidence, and calls
DeepSeek in the background. The frontend polls `GET /api/runs` and
`GET /api/runs/{run_id}` every two seconds until `done` or `failed`.

Configure `DEEPSEEK_API_KEY` in the backend service. Keep `event_id` stable
when retrying the same event so the backend returns the existing run.
