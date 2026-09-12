#!/usr/bin/env bash

# 先加载 ROS 环境；ROS setup.bash 需要在未启用 set -u 时执行
source /opt/ros/humble/setup.bash
export ROS_DOMAIN_ID=30

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MODEL_FILE="$ROOT_DIR/models/tc01_wall/model.sdf"
ENTITY_NAME="tc01_wall"

# 已试放确认的最终参数
SPAWN_X=0.60
SPAWN_Y=0.00
SPAWN_Z=0.25

if [ ! -f "$MODEL_FILE" ]; then
  echo "错误：找不到障碍物模型：$MODEL_FILE" >&2
  exit 1
fi

echo "[TC-01] 清理可能残留的旧墙体..."
ros2 service call /delete_entity gazebo_msgs/srv/DeleteEntity \
  "{name: '$ENTITY_NAME'}" >/dev/null 2>&1 || true

echo "[TC-01] 在 ($SPAWN_X, $SPAWN_Y, $SPAWN_Z) 生成墙体..."
ros2 run gazebo_ros spawn_entity.py \
  -entity "$ENTITY_NAME" \
  -file "$MODEL_FILE" \
  -x "$SPAWN_X" \
  -y "$SPAWN_Y" \
  -z "$SPAWN_Z"

echo "[TC-01] 注入完成。请确认 Gazebo 中出现红色墙体。"
