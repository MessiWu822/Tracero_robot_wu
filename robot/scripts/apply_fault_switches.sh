#!/usr/bin/env bash
set -euo pipefail

SIMULATIONS_DIR="${1:?usage: apply_fault_switches.sh <turtlebot3_simulations-dir>}"
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

pattern = r'\b(escape_range_?)\s*=\s*30\.0\s*\*\s*DEG2RAD\s*;'
matches = list(re.finditer(pattern, text))
if 'TRACERO_F_B1' in text:
    expected = r'\bescape_range_?\s*= std::getenv\("TRACERO_F_B1"\) != nullptr && std::string\(std::getenv\("TRACERO_F_B1"\)\) == "1" \? 30\.0 : 30\.0 \* DEG2RAD;'
    if len(re.findall(expected, text)) != 1:
        raise SystemExit(f"Unrecognized existing B1 branch in {path}; review it first")
    print(f"Fault switches already present: {path}")
    raise SystemExit(0)
if len(matches) != 1:
    raise SystemExit(f"Expected exactly one B1 anchor in {path}, found {len(matches)}")
name = matches[0].group(1)
anchor = matches[0].group(0)

if "#include <cstdlib>" not in text:
    include_match = re.search(r"^#include [^\n]+\n", text, re.MULTILINE)
    if include_match is None:
        raise SystemExit(f"Could not find include block in {path}")
    text = (
        text[:include_match.end()]
        + "#include <cstdlib>\n"
        + text[include_match.end():]
    )

replacement = (
    f'{name} = std::getenv("TRACERO_F_B1") != nullptr && '
    'std::string(std::getenv("TRACERO_F_B1")) == "1" ? 30.0 : 30.0 * DEG2RAD;'
)
if '#include <string>' not in text:
    text = text.replace('#include <cstdlib>', '#include <cstdlib>\n#include <string>', 1)
text = text.replace(anchor, replacement, 1)
path.write_text(text, encoding="utf-8", newline="\n")
print(f"Applied TRACERO_F_B1 to {path}")
PY
