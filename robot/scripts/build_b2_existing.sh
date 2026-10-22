#!/usr/bin/env bash
set -eo pipefail
source /opt/ros/humble/setup.bash
source /root/turtlebot3_ws/install/setup.bash
set -u
B2_ROOT="${TRACERO_B2_ROOT:-/root/workspace/tracero_b2}"
ORIGINAL=/root/turtlebot3_ws/src/turtlebot3_simulations/turtlebot3_gazebo
TARGET="$B2_ROOT/ws/src/turtlebot3_gazebo"
case "$(realpath -m "$B2_ROOT")" in
  /root/workspace/tracero_b1|/root/workspace/tracero_b1/*|/root/workspace/tracero_tc01|/root/workspace/tracero_tc01/*|/root/turtlebot3_ws|/root/turtlebot3_ws/*)
    echo "B2_ROOT must be independent from B1, TC01 and the original workspace" >&2
    exit 2 ;;
esac
mkdir -p "$B2_ROOT/ws/src"
if [[ ! -d "$TARGET" ]]; then
  cp -a "$ORIGINAL" "$TARGET"
fi
if grep -q TRACERO_F_B1 "$TARGET/src/turtlebot3_drive.cpp"; then
  echo "B2 source contains a B1 fault branch; use an independent clean copy" >&2
  exit 2
fi
bash "$B2_ROOT/scripts/apply_b2_fault_switch.sh" "$B2_ROOT/ws/src"
cd "$B2_ROOT/ws"
colcon build --packages-select turtlebot3_gazebo \
  --cmake-args -DCMAKE_BUILD_TYPE=Release
