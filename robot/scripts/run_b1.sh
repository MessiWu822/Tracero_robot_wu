#!/usr/bin/env bash
set -eo pipefail

source /opt/ros/humble/setup.bash
B1_ROOT="${TRACERO_B1_ROOT:-/root/workspace/tracero_b1}"
if [[ -f "$B1_ROOT/ws/install/setup.bash" ]]; then
  source /root/turtlebot3_ws/install/setup.bash
  source "$B1_ROOT/ws/install/setup.bash"
fi
set -u
export TURTLEBOT3_MODEL=burger
export ROS_DOMAIN_ID="${B1_ROS_DOMAIN_ID:-31}"

# B1 is the S1 turtlebot3_drive test. Keep TC-01/Nav2 fault state out of the
# process so this entry point cannot accidentally combine the two scenarios.
unset \
  TRACERO_F_A1 TRACERO_F_A2 TRACERO_F_A3 \
  TRACERO_F_B2 \
  TRACERO_F_C1 TRACERO_F_C2 \
  TRACERO_F_D1 TRACERO_F_D2 TRACERO_F_D3

case "${1:-clean}" in
  clean)
    unset TRACERO_F_B1
    ;;
  fault)
    export TRACERO_F_B1=1
    ;;
  *)
    echo "usage: $0 clean|fault" >&2
    exit 2
    ;;
esac

python3 - <<'PY'
from pathlib import Path
from ament_index_python.packages import get_package_prefix
import rclpy

binary = Path(get_package_prefix('turtlebot3_gazebo')) / 'lib/turtlebot3_gazebo/turtlebot3_drive'
if b'TRACERO_F_B1' not in binary.read_bytes():
    raise SystemExit(f'The selected binary does not contain B1: {binary}')
rclpy.init()
node = rclpy.create_node('b1_startup_check')
try:
    for _ in range(10):
        rclpy.spin_once(node, timeout_sec=0.1)
    publishers = node.get_publishers_info_by_topic('/cmd_vel')
    if publishers:
        raise SystemExit('Stop existing cmd_vel publishers before B1: ' +
                         ', '.join(p.node_name for p in publishers))
finally:
    node.destroy_node()
    rclpy.shutdown()
print(f'B1 binary: {binary}')
PY

exec ros2 run turtlebot3_gazebo turtlebot3_drive
