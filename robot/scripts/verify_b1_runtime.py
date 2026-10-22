"""Run clean/fault/recovery in Gazebo and save real topic evidence and bags."""
import hashlib
import json
import math
import os
from pathlib import Path
import signal
import subprocess
import time

import rclpy
from rclpy.qos import qos_profile_sensor_data
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from sensor_msgs.msg import LaserScan
from rosgraph_msgs.msg import Clock


ROOT = Path(os.environ.get('TRACERO_B1_ROOT', '/root/workspace/tracero_b1'))
RUN = ROOT / 'logs' / time.strftime('verification_%Y%m%d_%H%M%S')
RUN.mkdir(parents=True)


def stop(process):
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGINT)
        try:
            process.wait(timeout=12)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=12)


def case(mode):
    directory = RUN / mode
    directory.mkdir()
    node = rclpy.create_node('b1_verifier')
    observations = {'scan': 0, 'odom': [], 'cmd': [], 'clock': None}

    def odom(msg):
        p = msg.pose.pose.position
        q = msg.pose.pose.orientation
        yaw = math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y**2 + q.z**2))
        observations['odom'].append([observations['clock'], p.x, p.y, yaw])

    def cmd(msg):
        observations['cmd'].append([observations['clock'], msg.linear.x, msg.angular.z])

    def scan(msg):
        observations['scan'] += 1

    def clock(msg):
        observations['clock'] = msg.clock.sec + msg.clock.nanosec * 1e-9

    node.create_subscription(Odometry, '/odom', odom, 10)
    node.create_subscription(Twist, '/cmd_vel', cmd, 10)
    node.create_subscription(LaserScan, '/scan', scan, qos_profile_sensor_data)
    node.create_subscription(Clock, '/clock', clock, qos_profile_sensor_data)
    processes = []
    files = []
    result = {'mode': mode, 'passed': False}
    try:
        def launch(command, name):
            stream = (directory / name).open('w')
            files.append(stream)
            process = subprocess.Popen(command, stdout=stream, stderr=subprocess.STDOUT,
                                       start_new_session=True)
            processes.append(process)
            return process

        simulation = launch(['bash', str(ROOT / 'scripts/launch_b1_simulation.sh'), 'false'], 'gazebo.log')
        deadline = time.monotonic() + 60
        while observations['scan'] < 3 or not observations['odom'] or observations['clock'] is None:
            if simulation.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError('Gazebo/scan/odom not ready; see gazebo.log')
            rclpy.spin_once(node, timeout_sec=0.1)
        if node.count_publishers('/cmd_vel'):
            raise RuntimeError('Another cmd_vel publisher exists before B1 starts')
        launch(['ros2', 'bag', 'record', '-o', str(directory / 'bag'),
                '/clock', '/scan', '/odom', '/cmd_vel', '/tf', '/tf_static'], 'bag.log')
        driver = launch(['bash', str(ROOT / 'scripts/run_b1.sh'),
                         'fault' if mode == 'fault' else 'clean'], 'drive.log')
        started = observations['clock']
        deadline = time.monotonic() + 60
        while observations['clock'] - started < 18:
            if driver.poll() is not None or simulation.poll() is not None:
                raise RuntimeError('Driver or Gazebo exited early')
            if time.monotonic() > deadline:
                raise RuntimeError('Simulation clock did not advance 18 seconds')
            rclpy.spin_once(node, timeout_sec=0.05)
        publishers = node.get_publishers_info_by_topic('/cmd_vel')
        result['publishers'] = [item.node_name for item in publishers]
        if len(publishers) != 1 or publishers[0].node_name != 'turtlebot3_drive_node':
            raise RuntimeError('Expected the B1 driver to be the only cmd_vel publisher')
        odometry = observations['odom']
        commands = observations['cmd']
        result['scan_frames'] = observations['scan']
        result['simulation_seconds'] = observations['clock'] - started
        result['cmd_frames'] = len(commands)
        result['forward_frames'] = sum(v > 0.05 for _, v, _ in commands)
        result['turn_frames'] = sum(abs(w) > 0.5 for _, _, w in commands)
        result['displacement_m'] = math.hypot(odometry[-1][1] - odometry[0][1],
                                              odometry[-1][2] - odometry[0][2])
        result['accumulated_yaw_rad'] = sum(abs(math.atan2(math.sin(b[3]-a[3]),
                                                         math.cos(b[3]-a[3])))
                                             for a, b in zip(odometry, odometry[1:]))
        if mode == 'fault':
            result['passed'] = (len(commands) > 100 and result['forward_frames'] == 0
                                and result['turn_frames'] / len(commands) > 0.95
                                and result['displacement_m'] < 0.2
                                and result['accumulated_yaw_rad'] > 2 * math.pi)
        else:
            result['passed'] = result['forward_frames'] > 100 and result['displacement_m'] > 0.5
    except Exception as error:
        result['error'] = str(error)
    finally:
        for process in reversed(processes):
            stop(process)
        for stream in files:
            stream.close()
        node.destroy_node()
        (directory / 'topics.json').write_text(json.dumps(observations), encoding='utf-8')
        (directory / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result), flush=True)
    return result


def main():
    os.environ['ROS_DOMAIN_ID'] = '31'
    os.environ['B1_ROS_DOMAIN_ID'] = '31'
    rclpy.init()
    results = []
    try:
        for mode in ['clean', 'fault', 'recovery']:
            results.append(case(mode))
            if not results[-1]['passed']:
                break
    finally:
        rclpy.shutdown()
    binary = ROOT / 'ws/install/turtlebot3_gazebo/lib/turtlebot3_gazebo/turtlebot3_drive'
    report = {'binary': str(binary), 'sha256': hashlib.sha256(binary.read_bytes()).hexdigest(),
              'cases': results, 'passed': len(results) == 3 and all(r['passed'] for r in results)}
    (RUN / 'summary.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('Evidence: ' + str(RUN), flush=True)
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
