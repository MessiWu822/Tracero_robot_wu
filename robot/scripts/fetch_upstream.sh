#!/usr/bin/env bash
set -euo pipefail

ROBOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${1:-$ROBOT_DIR/workspace/src/upstream}"

mkdir -p "$SOURCE_DIR"
if find "$SOURCE_DIR" -mindepth 1 -print -quit | grep -q .; then
  echo "Source directory is not empty: $SOURCE_DIR" >&2
  exit 1
fi

vcs import "$SOURCE_DIR" < "$ROBOT_DIR/upstream/turtlebot3-humble.repos"
