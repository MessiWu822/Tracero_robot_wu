"""Check the B1 source transformation without requiring ROS or Docker."""

from pathlib import Path
import os
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
INJECTOR = ROOT / "scripts" / "apply_fault_switches.sh"
RUN_B1 = ROOT / "scripts" / "run_b1.sh"
TC01_LAUNCH = ROOT / "simulation" / "scripts" / "launch_tc01_navigation.sh"


def bash_command():
    configured = os.environ.get("BASH")
    if configured:
        return configured
    if os.name == "nt":
        git_bash = Path(r"C:\Program Files\Git\bin\bash.exe")
        if git_bash.exists():
            return str(git_bash)
    return shutil.which("bash") or "bash"

SOURCE = """#include <algorithm>\n\nclass Turtlebot3Drive {\n  void init() {\n    escape_range_ = 30.0 * DEG2RAD;\n  }\n  double escape_range_;\n};\n"""


def main():
    b1_runner = RUN_B1.read_text(encoding="utf-8")
    tc01_runner = TC01_LAUNCH.read_text(encoding="utf-8")
    assert 'export TRACERO_F_B1=1' in b1_runner
    assert 'unset TRACERO_F_B1' in b1_runner
    assert 'unset TRACERO_F_B1' in tc01_runner

    with tempfile.TemporaryDirectory() as directory:
        source_dir = Path(directory) / "turtlebot3_simulations"
        source = source_dir / "turtlebot3_gazebo" / "src" / "turtlebot3_drive.cpp"
        source.parent.mkdir(parents=True)
        source.write_text(SOURCE, encoding="utf-8")

        command = [bash_command(), str(INJECTOR), str(source_dir)]
        environment = os.environ.copy()
        if os.name == "nt":
            environment["PYTHON_BIN"] = str(
                Path(os.sys.executable).resolve()
            )
        subprocess.run(command, check=True, env=environment)
        transformed = source.read_text(encoding="utf-8")
        assert '#include <cstdlib>' in transformed
        assert 'std::getenv("TRACERO_F_B1")' in transformed
        assert '? 30.0 : 30.0 * DEG2RAD;' in transformed

        subprocess.run(command, check=True, env=environment)
        assert source.read_text(encoding="utf-8") == transformed

    print("B1 fault-switch transformation passed")


if __name__ == "__main__":
    main()
