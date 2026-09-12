# Tracero

Tracero collects runtime evidence when navigation failures occur in autonomous
robots. The repository currently contains:

- `first try/tracero_backend`: the original backend prototype;
- `frontend`: the Tracero web application;
- `tracero_agent`: the ROS 2 runtime evidence collector;
- `robot`: a reproducible TurtleBot3 Burger environment for ROS 2 Humble,
  including the TC-01 fault injector, pinned upstream source revisions,
  patches, Docker support, and operator documentation.

To run the backend locally, `cd first try/tracero_backend && uvicorn app:app
--reload` and export `DEEPSEEK_API_KEY` for the reasoning endpoints.

Start with [robot/README.md](robot/README.md) for the robot and simulation
workflow.

The project is licensed under Apache License 2.0 unless a subdirectory carries
its own LICENSE file. Third-party projects retain their original licenses; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
