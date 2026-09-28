# TC-01 collision simulation assets

- models/tc01_wall is a visible red wall with a low physical collision rail.
- maps contains two maps recorded for local TurtleBot3 tests.
- config contains a no-recovery Nav2 behavior tree and parameter overlay.
- scripts contains manual spawn/reset helpers and the TC-01 Nav2 launcher.

The automatic injector uses the model copy installed from
src/tc01_auto_injector. Keep both copies identical when changing the scenario.
The Nav2 launcher sources ROS 2 Humble and, when present, the container's
`/root/turtlebot3_ws` and `/root/nav2_ws` overlays automatically. See
../docs/simulation.md for the supported workflow.

The collision rail is 0.12 m high. The TC-01 parameter overlay disables the
dynamic obstacle and voxel layers, limits angular velocity to 0.01 rad/s, and
uses a 0.5-second progress timeout. Gazebo publishes real contacts on
`/tc01/bumper_states`. Validate the contact and final `ABORTED` status in the
target container before recording a formal run.
