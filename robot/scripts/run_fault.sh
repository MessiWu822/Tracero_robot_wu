#!/usr/bin/env bash
set -euo pipefail

FAULT_ID="${1:-clean}"
if [[ "$#" -gt 0 ]]; then
  shift
fi

unset \
  TRACERO_F_A1 TRACERO_F_A2 TRACERO_F_A3 \
  TRACERO_F_B1 TRACERO_F_B2 \
  TRACERO_F_C1 TRACERO_F_C2 \
  TRACERO_F_D1 TRACERO_F_D2 TRACERO_F_D3

case "$FAULT_ID" in
  clean)
    ;;
  B1)
    export TRACERO_F_B1=1
    ;;
  A1|A2|A3|B2|C1|C2|D1|D2|D3)
    echo "Fault switch $FAULT_ID is registered but has no implementation yet" >&2
    exit 3
    ;;
  *)
    echo "usage: $0 clean|B1|A1|A2|A3|B2|C1|C2|D1|D2|D3 [command ...]" >&2
    exit 2
    ;;
esac

if [ "$#" -eq 0 ]; then
  set -- ros2 run turtlebot3_gazebo turtlebot3_drive
fi

exec "$@"
