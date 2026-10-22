#!/usr/bin/env bash
set -eo pipefail
source /opt/ros/humble/setup.bash
source /root/turtlebot3_ws/install/setup.bash
set -u
B1_ROOT="${TRACERO_B1_ROOT:-/root/workspace/tracero_b1}"
ORIGINAL=/root/turtlebot3_ws/src/turtlebot3_simulations/turtlebot3_gazebo
TARGET="$B1_ROOT/ws/src/turtlebot3_gazebo"
mkdir -p "$B1_ROOT/ws/src"
if [[ ! -d "$TARGET" ]]; then
  cp -a "$ORIGINAL" "$TARGET"
fi
bash "$B1_ROOT/scripts/apply_fault_switches.sh" "$B1_ROOT/ws/src"
cd "$B1_ROOT/ws"
colcon build --packages-select turtlebot3_gazebo \
  --cmake-args -DCMAKE_BUILD_TYPE=Release
