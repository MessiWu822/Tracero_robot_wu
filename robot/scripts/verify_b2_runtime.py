"""Run B2 clean/fault/recovery rounds in its isolated S1 simulation."""
import json
import math
import os
from pathlib import Path
import signal
import subprocess
import time

import rclpy
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from rosgraph_msgs.msg import Clock
from sensor_msgs.msg import LaserScan
from rclpy.qos import qos_profile_sensor_data


ROOT = Path(os.environ.get("TRACERO_B2_ROOT", "/root/workspace/tracero_b2"))


def stop(process):
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGINT)
        try:
            process.wait(timeout=12)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=12)


def run_case(node, mode):
    state = {"clock": None, "scan": 0, "inf": 0, "selected_inf": 0,
             "odom": [], "cmd": []}

    def clock(message):
        state["clock"] = message.clock.sec + message.clock.nanosec * 1e-9

    def scan(message):
        state["scan"] += 1
        state["inf"] += sum(not math.isfinite(value) for value in message.ranges)
        for index in (0, 30, 330):
            if index < len(message.ranges) and not math.isfinite(message.ranges[index]):
                state["selected_inf"] += 1

    def odom(message):
        position = message.pose.pose.position
        state["odom"].append((position.x, position.y))

    def command(message):
        state["cmd"].append((message.linear.x, message.angular.z))

    subscriptions = [
        node.create_subscription(Clock, "/clock", clock, qos_profile_sensor_data),
        node.create_subscription(LaserScan, "/scan", scan, qos_profile_sensor_data),
        node.create_subscription(Odometry, "/odom", odom, 10),
        node.create_subscription(Twist, "/cmd_vel", command, 10),
    ]
    del subscriptions
    processes = []
    streams = []
    directory = ROOT / "logs" / "b2_runtime"
    directory.mkdir(parents=True, exist_ok=True)
    try:
        gazebo_log = (directory / f"{mode}_gazebo.log").open("w")
        streams.append(gazebo_log)
        gazebo = subprocess.Popen(
            ["bash", str(ROOT / "scripts/launch_b2_simulation.sh"), "false"],
            stdout=gazebo_log, stderr=subprocess.STDOUT, start_new_session=True)
        processes.append(gazebo)
        deadline = time.monotonic() + 60
        while state["clock"] is None or state["scan"] < 3:
            if gazebo.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError("B2 Gazebo did not publish clock and scan")
            rclpy.spin_once(node, timeout_sec=0.1)
        driver_log = (directory / f"{mode}_driver.log").open("w")
        streams.append(driver_log)
        driver = subprocess.Popen(
            ["bash", str(ROOT / "scripts/run_b2.sh"), mode],
            stdout=driver_log, stderr=subprocess.STDOUT, start_new_session=True)
        processes.append(driver)
        started = state["clock"]
        deadline = time.monotonic() + 60
        while state["clock"] - started < 12:
            if driver.poll() is not None or gazebo.poll() is not None:
                raise RuntimeError(f"B2 {mode} process exited early")
            if time.monotonic() > deadline:
                raise RuntimeError("B2 simulation clock did not advance")
            rclpy.spin_once(node, timeout_sec=0.05)
        displacement = 0.0
        if len(state["odom"]) > 1:
            displacement = math.hypot(
                state["odom"][-1][0] - state["odom"][0][0],
                state["odom"][-1][1] - state["odom"][0][1])
        result = {
            "mode": mode,
            "simulation_seconds": state["clock"] - started,
            "scan_frames": state["scan"],
            "scan_inf_values": state["inf"],
            "selected_inf_frames": state["selected_inf"],
            "cmd_frames": len(state["cmd"]),
            "forward_frames": sum(linear > 0.05 for linear, _ in state["cmd"]),
            "turn_frames": sum(abs(angular) > 0.5 for _, angular in state["cmd"]),
            "displacement_m": displacement,
        }
        result["passed"] = (
            result["scan_frames"] > 10 and result["selected_inf_frames"] > 0
            and (mode == "fault" and result["forward_frames"] < result["turn_frames"]
                 or mode != "fault" and result["forward_frames"] > 20))
        return result
    finally:
        for process in reversed(processes):
            stop(process)
        for stream in streams:
            stream.close()


def main():
    os.environ["ROS_DOMAIN_ID"] = "32"
    os.environ["B2_ROS_DOMAIN_ID"] = "32"
    rclpy.init()
    node = rclpy.create_node("b2_runtime_verifier")
    try:
        results = [run_case(node, mode) for mode in ("clean", "fault", "clean")]
    finally:
        node.destroy_node()
        rclpy.shutdown()
    output = {"binary": str(ROOT / "ws/install/turtlebot3_gazebo/lib/turtlebot3_gazebo/turtlebot3_drive"),
              "cases": results, "passed": all(item["passed"] for item in results)}
    path = ROOT / "logs" / "b2_runtime" / "summary.json"
    path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(json.dumps(output, indent=2))
    raise SystemExit(0 if output["passed"] else 1)


if __name__ == "__main__":
    main()
