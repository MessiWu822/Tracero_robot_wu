#!/usr/bin/env bash

# 先加载 ROS 环境；ROS setup.bash 需要在未启用 set -u 时执行。
source /opt/ros/humble/setup.bash
export ROS_DOMAIN_ID=30

set -euo pipefail

ENTITY_NAME="tc01_wall"

echo "[TC-01] 删除墙体：$ENTITY_NAME"
ros2 service call /delete_entity gazebo_msgs/srv/DeleteEntity \
  "{name: '$ENTITY_NAME'}" || true

echo "[TC-01] 重置完成。若本次导航已中止，请在 RViz2 重新设置初始位姿和目标。"
