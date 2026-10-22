"""Check the B2 source transformation without ROS or Docker."""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
INJECTOR = ROOT / "scripts" / "apply_b2_fault_switch.sh"


def bash_command():
    configured = os.environ.get("BASH")
    if configured:
        return configured
    if os.name == "nt":
        git_bash = Path(r"C:\Program Files\Git\bin\bash.exe")
        if git_bash.exists():
            return str(git_bash)
    return shutil.which("bash") or "bash"


SOURCE = """#include <cmath>\nvoid f(const Scan& msg) {\n  for (int num = 0; num < 3; ++num) {\n    if (std::isinf(msg->ranges.at(num))) {\n      scan_data_[num] = msg->range_max;\n    }\n  }\n}\n"""


def main():
    with tempfile.TemporaryDirectory() as directory:
        source_dir = Path(directory) / "turtlebot3_simulations"
        source = source_dir / "turtlebot3_gazebo" / "src" / "turtlebot3_drive.cpp"
        source.parent.mkdir(parents=True)
        source.write_text(SOURCE, encoding="utf-8")
        command = [bash_command(), str(INJECTOR), str(source_dir)]
        environment = os.environ.copy()
        if os.name == "nt":
            environment["PYTHON_BIN"] = str(Path(os.sys.executable).resolve())
        subprocess.run(command, check=True, env=environment)
        transformed = source.read_text(encoding="utf-8")
        assert 'std::getenv("TRACERO_F_B2")' in transformed
        assert '? 0.0 : msg->range_max;' in transformed
        subprocess.run(command, check=True, env=environment)
        assert source.read_text(encoding="utf-8") == transformed
    print("B2 fault-switch transformation passed")


if __name__ == "__main__":
    main()
