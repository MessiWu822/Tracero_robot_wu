#!/usr/bin/env bash
set -euo pipefail

SIMULATIONS_DIR="${1:?usage: apply_b2_fault_switch.sh <turtlebot3_simulations-dir>}"
SOURCE_FILE="$SIMULATIONS_DIR/turtlebot3_gazebo/src/turtlebot3_drive.cpp"
if [ ! -f "$SOURCE_FILE" ]; then
  echo "Fault injection source file not found: $SOURCE_FILE" >&2
  exit 1
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
"$PYTHON_BIN" - "$SOURCE_FILE" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
anchor = r'\bscan_data_\[num\]\s*=\s*msg->range_max\s*;'
branch = (
    r'scan_data_\[num\]\s*=\s*std::getenv\("TRACERO_F_B2"\) '
    r'!= nullptr && std::string\(std::getenv\("TRACERO_F_B2"\)\) == "1" '
    r'\? 0\.0 : msg->range_max\s*;'
)
matches = list(re.finditer(anchor, text))
if not matches and len(re.findall(branch, text)) == 1:
    print(f"B2 fault switch already present: {path}")
    raise SystemExit(0)
if len(matches) != 1:
    raise SystemExit(f"Expected exactly one B2 anchor in {path}, found {len(matches)}")

for header in ("cstdlib", "string"):
    if f"#include <{header}>" not in text:
        include = re.search(r"^#include [^\n]+\n", text, re.MULTILINE)
        if include is None:
            raise SystemExit(f"Could not find include block in {path}")
        text = text[:include.end()] + f"#include <{header}>\n" + text[include.end():]

replacement = (
    'scan_data_[num] = std::getenv("TRACERO_F_B2") != nullptr && '
    'std::string(std::getenv("TRACERO_F_B2")) == "1" ? '
    '0.0 : msg->range_max;'
)
text = text.replace(matches[0].group(0), replacement, 1)
path.write_text(text, encoding="utf-8", newline="\n")
print(f"Applied TRACERO_F_B2 to {path}")
PY
