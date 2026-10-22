#!/usr/bin/env bash

# Start Nav2 with the TC-01 no-recovery behavior tree and short progress
# timeout while preserving the upstream Burger parameter file.
source /opt/ros/humble/setup.bash

# TC-01 is the S2/Nav2 scenario; never inherit S1 source faults.
unset TRACERO_F_B1 TRACERO_F_B2

# Load source-built TurtleBot3/Nav2 overlays when running in the project
# container. Missing overlays are fine on a system-only ROS installation.
for setup_file in \
  /root/turtlebot3_ws/install/setup.bash \
  /root/nav2_ws/install/setup.bash; do
  if [[ -f "$setup_file" ]]; then
    source "$setup_file"
  fi
done

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MODEL="${TURTLEBOT3_MODEL:-burger}"
MAP_FILE="${1:-$SIM_DIR/maps/turtlebot3_map_v2.yaml}"
NAV2_SHARE="$(ros2 pkg prefix turtlebot3_navigation2)/share/turtlebot3_navigation2"
BASE_PARAMS="$NAV2_SHARE/param/${MODEL}.yaml"
OVERLAY="$SIM_DIR/config/tc01_nav2_overrides.yaml"
BT_XML="$SIM_DIR/config/tc01_nav_to_pose_no_recovery.xml"
MERGED_PARAMS="$(mktemp --suffix=.yaml tc01_nav2_XXXXXX)"
TMP_OVERLAY="$(mktemp --suffix=.yaml tc01_nav2_overlay_XXXXXX)"
trap 'rm -f "$MERGED_PARAMS" "$TMP_OVERLAY"' EXIT

if [[ ! -f "$BASE_PARAMS" ]]; then
  echo "找不到 TurtleBot3 Nav2 参数文件：$BASE_PARAMS" >&2
  exit 1
fi

python3 - "$OVERLAY" "$BT_XML" "$TMP_OVERLAY" <<'PY'
import pathlib
import sys

overlay = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
overlay = overlay.replace("__TC01_BT_XML__", str(pathlib.Path(sys.argv[2]).resolve()))
pathlib.Path(sys.argv[3]).write_text(overlay, encoding="utf-8")
PY

python3 "$SCRIPT_DIR/merge_nav2_params.py" \
  "$BASE_PARAMS" "$TMP_OVERLAY" "$MERGED_PARAMS"

export ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-30}"
ros2 launch turtlebot3_navigation2 navigation2.launch.py \
  use_sim_time:=true \
  map:="$MAP_FILE" \
  params_file:="$MERGED_PARAMS"
