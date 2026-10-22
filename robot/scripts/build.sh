#!/usr/bin/env bash
set -eo pipefail

ROBOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="${1:-$ROBOT_DIR/workspace}"

source /opt/ros/humble/setup.bash
set -u
mkdir -p "$WORKSPACE_DIR/src"

if [ ! -e "$WORKSPACE_DIR/src/tracero_agent" ]; then
  ln -s "$ROBOT_DIR/../tracero_agent" "$WORKSPACE_DIR/src/tracero_agent"
fi

if [ ! -e "$WORKSPACE_DIR/src/tc01_auto_injector" ]; then
  ln -s "$ROBOT_DIR/src/tc01_auto_injector" \
    "$WORKSPACE_DIR/src/tc01_auto_injector"
fi

bash "$ROBOT_DIR/scripts/apply_fault_switches.sh" \
  "$WORKSPACE_DIR/src/upstream/turtlebot3_simulations"

if [ "${SKIP_ROSDEP:-0}" != "1" ]; then
  rosdep install \
    --from-paths "$WORKSPACE_DIR/src" \
    --ignore-src \
    --rosdistro humble \
    -r -y
fi

cd "$WORKSPACE_DIR"
colcon build --symlink-install
