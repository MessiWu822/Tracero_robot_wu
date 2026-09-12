# TC-01 simulation assets

- models/tc01_wall is the red static obstacle used by the injector.
- maps contains two maps recorded for local TurtleBot3 tests.
- scripts contains manual spawn and reset helpers for debugging.

The automatic injector uses the model copy installed from
src/tc01_auto_injector. Keep both copies identical when changing the scenario.
The scripts expect ROS 2 Humble plus the TurtleBot3 and Navigation2 workspaces
to be sourced. See ../docs/simulation.md for the supported workflow.
