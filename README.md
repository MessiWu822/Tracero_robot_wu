# Tracero_robot

Tracero collects runtime evidence when navigation failures occur in autonomous
robots. The repository currently contains:

Start with [robot/README.md](robot/README.md) for the robot and simulation
workflow.

## TC-01 collision test

The current TC-01 profile is a reproducible overlay for the state reached
after completing `A-TurtleBot3仿真完整指南_Windows11_WSL2_Docker(1).md`. It does
not modify Nav2 source. It adds a Gazebo wall/contact model, a manual and an
automatic injector, a no-recovery behavior tree, a Nav2 parameter overlay, and
Agent evidence for the physical collision and the resulting navigation failure.

The complete beginner procedure is in
[`robot/docs/tc01.md`](robot/docs/tc01.md). It covers container paths, the
required ROS overlays, building `tracero_agent` and `tc01_auto_injector`, four
terminal startup commands, initial pose, both injection modes, acceptance
checks, reset, and troubleshooting. The short version is:

```bash
# inside the turtlebot3_src container
source /opt/ros/humble/setup.bash
source /root/turtlebot3_ws/install/setup.bash
source /root/nav2_ws/install/setup.bash
export TURTLEBOT3_MODEL=burger ROS_DOMAIN_ID=30

# Terminal 1
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py x_pose:=-0.4 y_pose:=0.0

# Terminal 2, after Gazebo is ready
/root/workspace/tracero_tc01/scripts/launch_tc01_navigation.sh \
  /root/workspace/tracero_tc01/maps/turtlebot3_map_v2.yaml

# Terminal 3
source /root/workspace/tracero_agent_ws/install/setup.bash
ros2 launch tracero_agent agent.launch.py

# Terminal 4: spawn the wall, then send a goal beyond x=0.60
/root/workspace/tracero_tc01/scripts/spawn_tc01_wall.sh
ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \
  "{pose: {header: {frame_id: map}, pose: {position: {x: 1.2, y: 0.0, z: 0.0}, orientation: {w: 1.0}}}}"
```

The valid result is a real `/tc01/bumper_states` contact followed by
`NavigateToPose` `ABORTED` (status `6`) and matching
`navigation_collision`/`navigation_failed` JSON files. Wait for
`/bt_navigator` to report `active [3]` before sending a goal; an inactive
Nav2 server rejects goals immediately.

The project is licensed under Apache License 2.0 unless a subdirectory carries
its own LICENSE file. Third-party projects retain their original licenses; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
