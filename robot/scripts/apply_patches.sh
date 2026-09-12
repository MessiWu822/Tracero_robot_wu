#!/usr/bin/env bash
set -euo pipefail

ROBOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_DIR="${1:-$ROBOT_DIR/workspace/src/upstream}"

apply_one() {
  local repository="$1"
  local patch_file="$2"
  local repository_dir="$UPSTREAM_DIR/$repository"

  git -C "$repository_dir" apply --check "$patch_file"
  git -C "$repository_dir" apply "$patch_file"
  echo "Applied $(basename "$patch_file") to $repository"
}

apply_one \
  turtlebot3 \
  "$ROBOT_DIR/patches/turtlebot3/0001-adapt-navigation-rviz-to-burger.patch"
