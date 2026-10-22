#!/usr/bin/env bash
set -eo pipefail
source /opt/ros/humble/setup.bash
source /root/turtlebot3_ws/install/setup.bash
B1_ROOT="${TRACERO_B1_ROOT:-/root/workspace/tracero_b1}"
source "$B1_ROOT/ws/install/setup.bash"
set -u
export TURTLEBOT3_MODEL=burger
export ROS_DOMAIN_ID="${B1_ROS_DOMAIN_ID:-31}"
export GAZEBO_MASTER_URI="${B1_GAZEBO_MASTER_URI:-http://127.0.0.1:11346}"
export GAZEBO_MODEL_PATH="$(ros2 pkg prefix turtlebot3_gazebo)/share/turtlebot3_gazebo/models:${GAZEBO_MODEL_PATH:-}"
unset TRACERO_F_B1
exec ros2 launch "$B1_ROOT/scenario/b1.launch.py" "gui:=${1:-true}"
