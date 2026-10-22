#!/usr/bin/env bash
set -eo pipefail
source /opt/ros/humble/setup.bash
B2_ROOT="${TRACERO_B2_ROOT:-/root/workspace/tracero_b2}"
source /root/turtlebot3_ws/install/setup.bash
source "$B2_ROOT/ws/install/setup.bash"
set -u
export TURTLEBOT3_MODEL=burger
export ROS_DOMAIN_ID="${B2_ROS_DOMAIN_ID:-32}"
unset TRACERO_F_B1 TRACERO_F_A1 TRACERO_F_A2 TRACERO_F_A3 \
  TRACERO_F_C1 TRACERO_F_C2 TRACERO_F_D1 TRACERO_F_D2 TRACERO_F_D3
case "${1:-clean}" in
  clean) unset TRACERO_F_B2 ;;
  fault) export TRACERO_F_B2=1 ;;
  *) echo "usage: $0 clean|fault" >&2; exit 2 ;;
esac
python3 - <<'PY'
from pathlib import Path
import os
from ament_index_python.packages import get_package_prefix
import rclpy
binary = Path(get_package_prefix('turtlebot3_gazebo')) / 'lib/turtlebot3_gazebo/turtlebot3_drive'
expected = Path(os.environ.get('TRACERO_B2_ROOT', '/root/workspace/tracero_b2')) / 'ws/install/turtlebot3_gazebo/lib/turtlebot3_gazebo/turtlebot3_drive'
if binary.resolve() != expected.resolve():
    raise SystemExit(f'The selected binary is not the B2 workspace: {binary}')
contents = binary.read_bytes()
if b'TRACERO_F_B1' in contents:
    raise SystemExit(f'B2 binary unexpectedly contains a B1 branch: {binary}')
if b'TRACERO_F_B2' not in contents:
    raise SystemExit(f'The selected binary does not contain B2: {binary}')
rclpy.init()
node = rclpy.create_node('b2_startup_check')
try:
    for _ in range(10): rclpy.spin_once(node, timeout_sec=0.1)
    publishers = node.get_publishers_info_by_topic('/cmd_vel')
    if publishers:
        raise SystemExit('Stop existing cmd_vel publishers before B2: ' +
                         ', '.join(p.node_name for p in publishers))
finally:
    node.destroy_node(); rclpy.shutdown()
print(f'B2 binary: {binary}')
PY
exec ros2 run turtlebot3_gazebo turtlebot3_drive
