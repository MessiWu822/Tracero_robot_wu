#!/usr/bin/env bash
set -eo pipefail

ROBOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="${1:-$ROBOT_DIR/workspace}"

source /opt/ros/humble/setup.bash
source "$WORKSPACE_DIR/install/setup.bash"
set -u

ros2 pkg prefix turtlebot3_gazebo >/dev/null
ros2 pkg prefix turtlebot3_navigation2 >/dev/null
ros2 pkg prefix nav2_bringup >/dev/null
ros2 pkg prefix tracero_agent >/dev/null
ros2 pkg prefix tc01_auto_injector >/dev/null
ros2 pkg executables tracero_agent | grep -q 'agent_node'
ros2 pkg executables tc01_auto_injector | grep -q 'tc01_auto_injector'

python3 -m py_compile \
  "$ROBOT_DIR/../tracero_agent/tracero_agent/agent_node.py" \
  "$ROBOT_DIR/src/tc01_auto_injector/tc01_auto_injector/auto_injector.py"

echo "Tracero TurtleBot3 smoke test passed"
