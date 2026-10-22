#!/usr/bin/env bash
set -eo pipefail
source /opt/ros/humble/setup.bash
source /root/turtlebot3_ws/install/setup.bash
B2_ROOT="${TRACERO_B2_ROOT:-/root/workspace/tracero_b2}"
source "$B2_ROOT/ws/install/setup.bash"
set -u
export TURTLEBOT3_MODEL=burger
export ROS_DOMAIN_ID="${B2_ROS_DOMAIN_ID:-32}"
export GAZEBO_MASTER_URI="${B2_GAZEBO_MASTER_URI:-http://127.0.0.1:11347}"
export GAZEBO_MODEL_PATH="$(ros2 pkg prefix turtlebot3_gazebo)/share/turtlebot3_gazebo/models:${GAZEBO_MODEL_PATH:-}"
unset TRACERO_F_B1 TRACERO_F_B2
exec ros2 launch "$B2_ROOT/scenario/b2.launch.py" "gui:=${1:-true}" "scene:=${2:-open}"
