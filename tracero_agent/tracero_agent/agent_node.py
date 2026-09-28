
import json
import math
import os
import queue
import shutil
import threading
import time
from collections import deque

import requests

import rclpy
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data

from action_msgs.msg import GoalStatusArray
from diagnostic_msgs.msg import DiagnosticArray
from gazebo_msgs.msg import ContactsState
from geometry_msgs.msg import Twist
from nav2_msgs.action._navigate_to_pose import (
    NavigateToPose_FeedbackMessage,
)
from nav_msgs.msg import OccupancyGrid, Odometry, Path
from sensor_msgs.msg import LaserScan
from std_srvs.srv import Trigger


def unix_time():
    return time.time()


def goal_key(uuid_message):
    return bytes(uuid_message.uuid).hex()


def finite_float(value, default=0.0):
    value = float(value)
    return value if math.isfinite(value) else float(default)


def uint8_value(value):
    if isinstance(value, (bytes, bytearray)):
        return value[0] if value else 0
    return int(value)


class TraceroAgent(Node):

    EVENT_KEYS = {
        "event_type",
        "trigger_time",
        "robot_id",
        "window",
        "params_snapshot",
        "static_index_version",
    }
    WINDOW_KEYS = {"pre_5s", "post_2s"}
    RECORD_KEYS = {"topic", "timestamp", "data"}

    def __init__(self):
        super().__init__("tracero_agent")

        self.declare_parameter("robot_id", "tc-01")
        self.declare_parameter("static_index_version", "v1")
        self.declare_parameter("backend_url", "http://127.0.0.1:8000")
        self.declare_parameter(
            "output_dir",
            "/root/workspace/tracero_agent_data",
        )
        self.declare_parameter("pre_window_sec", 5.0)
        self.declare_parameter("post_window_sec", 2.0)
        self.declare_parameter("injection_grace_sec", 2.0)
        self.declare_parameter("stuck_window_sec", 15.0)
        self.declare_parameter("min_goal_progress_m", 0.2)
        self.declare_parameter("max_demo_wait_sec", 60.0)
        self.declare_parameter("obstacle_distance_m", 0.8)
        self.declare_parameter("contact_topic", "/tc01/bumper_states")
        self.declare_parameter("wall_contact_token", "tc01_wall")
        self.declare_parameter("http_timeout_sec", 5.0)
        self.declare_parameter("max_retry_count", 3)
        self.declare_parameter("controller_frequency", 20.0)
        self.declare_parameter("update_frequency", 5.0)
        self.robot_id = str(self.get_parameter("robot_id").value)
        self.static_index_version = str(
            self.get_parameter("static_index_version").value
        )
        self.backend_url = str(
            self.get_parameter("backend_url").value
        ).rstrip("/")
        self.output_dir = str(
            self.get_parameter("output_dir").value
        )
        self.pre_window_sec = float(
            self.get_parameter("pre_window_sec").value
        )
        self.post_window_sec = float(
            self.get_parameter("post_window_sec").value
        )
        self.injection_grace_sec = float(
            self.get_parameter("injection_grace_sec").value
        )
        self.stuck_window_sec = float(
            self.get_parameter("stuck_window_sec").value
        )
        self.min_goal_progress_m = float(
            self.get_parameter("min_goal_progress_m").value
        )
        self.max_demo_wait_sec = float(
            self.get_parameter("max_demo_wait_sec").value
        )
        self.obstacle_distance_m = float(
            self.get_parameter("obstacle_distance_m").value
        )
        self.contact_topic = str(
            self.get_parameter("contact_topic").value
        )
        self.wall_contact_token = str(
            self.get_parameter("wall_contact_token").value
        )
        self.http_timeout_sec = float(
            self.get_parameter("http_timeout_sec").value
        )
        self.max_retry_count = int(
            self.get_parameter("max_retry_count").value
        )
        self.params_snapshot = {
            "controller_frequency": float(
                self.get_parameter("controller_frequency").value
            ),
            "update_frequency": float(
                self.get_parameter("update_frequency").value
            ),
        }

        if self.robot_id != "tc-01":
            raise ValueError("robot_id 必须保持为 tc-01")
        if self.static_index_version != "v1":
            raise ValueError("static_index_version 必须保持为 v1")

        self.events_dir = os.path.join(self.output_dir, "events")
        self.sent_dir = os.path.join(self.output_dir, "sent")
        self.failed_dir = os.path.join(self.output_dir, "failed")
        self.params_dir = os.path.join(self.output_dir, "params")
        for path in (
            self.events_dir,
            self.sent_dir,
            self.failed_dir,
            self.params_dir,
        ):
            os.makedirs(path, exist_ok=True)

        self.lock = threading.RLock()
        self.pre_buffer = deque()
        self.pending_event = None
        self.queued_events = deque()
        self.last_written = {}
        self.last_topic_time = {}

        self.injection_time = None
        self.last_obstacle_time = None
        self.last_contact_time = None
        self.collision_detected = False
        self.last_contact_names = []
        self.feedback_samples = deque()
        self.latest_feedback_goal = None
        self.active_goal = None
        self.active_status = None
        self.executing_goals = set()
        self.reported_events = set()

        self.send_queue = queue.Queue()
        self.stop_worker = threading.Event()
        self.worker = threading.Thread(
            target=self.http_worker,
            name="tracero-http-worker",
            daemon=True,
        )
        self.worker.start()

        self.create_subscription(
            LaserScan,
            "/scan",
            self.scan_callback,
            qos_profile_sensor_data,
        )
        self.create_subscription(
            ContactsState,
            self.contact_topic,
            self.contact_callback,
            10,
        )
        self.create_subscription(
            Odometry,
            "/odom",
            self.odom_callback,
            20,
        )
        self.create_subscription(
            Twist,
            "/cmd_vel",
            self.cmd_vel_callback,
            20,
        )
        self.create_subscription(
            OccupancyGrid,
            "/local_costmap/costmap",
            self.local_costmap_callback,
            10,
        )
        self.create_subscription(
            OccupancyGrid,
            "/global_costmap/costmap",
            self.global_costmap_callback,
            10,
        )
        self.create_subscription(
            Path,
            "/plan",
            self.plan_callback,
            10,
        )
        self.create_subscription(
            GoalStatusArray,
            "/navigate_to_pose/_action/status",
            self.status_callback,
            10,
        )
        self.create_subscription(
            NavigateToPose_FeedbackMessage,
            "/navigate_to_pose/_action/feedback",
            self.feedback_callback,
            20,
        )
        self.create_subscription(
            DiagnosticArray,
            "/diagnostics",
            self.diagnostics_callback,
            10,
        )

        self.create_service(
            Trigger,
            "/tracero_agent/injection",
            self.injection_callback,
        )
        self.create_service(
            Trigger,
            "/tracero_agent/reset",
            self.reset_callback,
        )
        self.create_service(
            Trigger,
            "/tracero_agent/status",
            self.agent_status_callback,
        )

        self.create_timer(0.1, self.timer_callback)
        self.create_timer(10.0, self.health_callback)
        self.params_timer = self.create_timer(
            3.0,
            self.send_initial_params,
        )

        self.restore_unsent_events()

        self.get_logger().info("Tracero Agent 已启动。")
        self.get_logger().info(
            f"robot_id={self.robot_id}, "
            f"static_index_version={self.static_index_version}"
        )
        self.get_logger().info(
            f"backend_url={self.backend_url}, "
            f"output_dir={self.output_dir}"
        )

    def should_sample(self, topic, now, interval):
        last = self.last_written.get(topic)
        if last is not None and now - last < interval:
            return False
        self.last_written[topic] = now
        return True

    def add_record(self, topic, data, interval=0.0):
        now = unix_time()
        with self.lock:
            self.last_topic_time[topic] = now
            if not self.should_sample(topic, now, interval):
                return

            record = {
                "topic": topic,
                "timestamp": now,
                "data": data,
            }
            self.pre_buffer.append(record)
            cutoff = now - self.pre_window_sec
            while self.pre_buffer:
                if self.pre_buffer[0]["timestamp"] >= cutoff:
                    break
                self.pre_buffer.popleft()

            pending_events = list(self.queued_events)
            if self.pending_event is not None:
                pending_events.insert(0, self.pending_event)
            for pending_event in pending_events:
                trigger_time = pending_event["trigger_time"]
                if (
                    trigger_time < now
                    <= trigger_time + self.post_window_sec
                ):
                    pending_event["post_2s"].append(record.copy())

    def scan_callback(self, message):
        valid = []
        front = []
        for index, raw_value in enumerate(message.ranges):
            value = float(raw_value)
            if not math.isfinite(value):
                continue
            if value < message.range_min or value > message.range_max:
                continue
            valid.append(value)
            angle = message.angle_min + index * message.angle_increment
            if abs(angle) <= math.radians(20.0):
                front.append(value)

        front_min = min(front) if front else None
        if front_min is not None and front_min <= self.obstacle_distance_m:
            with self.lock:
                self.last_obstacle_time = unix_time()

        data = {
            "range_min": finite_float(message.range_min),
            "range_max": finite_float(message.range_max),
            "front_min_range": (
                finite_float(front_min) if front_min is not None else None
            ),
            "valid_sample_count": len(valid),
        }
        self.add_record("/scan", data, interval=0.2)

    def contact_callback(self, message):
        """Record physical Gazebo contact independently of LiDAR evidence."""
        names = []
        for state in message.states:
            for value in (
                getattr(state, "collision1_name", ""),
                getattr(state, "collision2_name", ""),
            ):
                if value and value not in names:
                    names.append(value)

        if not names:
            return

        now = unix_time()
        wall_contact = any(
            self.wall_contact_token in name or "wall_collision" in name
            for name in names
        )
        with self.lock:
            self.last_contact_time = now
            self.collision_detected = True
            self.last_contact_names = names[:10]
            active_goal = self.latest_feedback_goal
            active_status = self.active_status
            injected = self.injection_time is not None

        self.add_record(
            self.contact_topic,
            {
                "collision_count": len(message.states),
                "collision_names": names[:10],
                "wall_contact": wall_contact,
            },
            interval=0.1,
        )

        if injected and wall_contact and active_status == 2 and active_goal:
            self.trigger_event("navigation_collision", active_goal)

    def odom_callback(self, message):
        pose = message.pose.pose
        twist = message.twist.twist
        data = {
            "position_x": finite_float(pose.position.x),
            "position_y": finite_float(pose.position.y),
            "orientation_z": finite_float(pose.orientation.z),
            "orientation_w": finite_float(pose.orientation.w),
            "linear_x": finite_float(twist.linear.x),
            "angular_z": finite_float(twist.angular.z),
        }
        self.add_record("/odom", data, interval=0.2)

    def cmd_vel_callback(self, message):
        data = {
            "linear_x": finite_float(message.linear.x),
            "linear_y": finite_float(message.linear.y),
            "angular_z": finite_float(message.angular.z),
        }
        self.add_record("/cmd_vel", data, interval=0.1)

    def costmap_data(self, message):
        occupied = sum(1 for value in message.data if value > 0)
        lethal = sum(1 for value in message.data if value >= 100)
        return {
            "width": int(message.info.width),
            "height": int(message.info.height),
            "resolution": finite_float(message.info.resolution),
            "occupied_cell_count": occupied,
            "lethal_cell_count": lethal,
        }

    def local_costmap_callback(self, message):
        self.add_record(
            "/local_costmap/costmap",
            self.costmap_data(message),
            interval=0.5,
        )

    def global_costmap_callback(self, message):
        self.add_record(
            "/global_costmap/costmap",
            self.costmap_data(message),
            interval=1.0,
        )

    def plan_callback(self, message):
        data = {"pose_count": len(message.poses)}
        if message.poses:
            start = message.poses[0].pose.position
            end = message.poses[-1].pose.position
            data.update(
                {
                    "start_x": finite_float(start.x),
                    "start_y": finite_float(start.y),
                    "end_x": finite_float(end.x),
                    "end_y": finite_float(end.y),
                }
            )
        self.add_record("/plan", data, interval=0.2)

    def newest_status(self, message):
        if not message.status_list:
            return None
        return max(
            message.status_list,
            key=lambda item: (
                item.goal_info.stamp.sec,
                item.goal_info.stamp.nanosec,
            ),
        )

    def status_callback(self, message):
        item = self.newest_status(message)
        if item is None:
            return

        key = goal_key(item.goal_info.goal_id)
        status = int(item.status)
        with self.lock:
            self.active_goal = key
            self.active_status = status
            if status == 2:
                self.executing_goals.add(key)

        self.add_record(
            "/navigate_to_pose/_action/status",
            {"status": status},
            interval=0.0,
        )

        if status == 6 and key in self.executing_goals:
            self.trigger_event("navigation_failed", key)

    def feedback_callback(self, message):
        now = unix_time()
        key = goal_key(message.goal_id)
        feedback = message.feedback
        distance = finite_float(feedback.distance_remaining)
        navigation_time = (
            feedback.navigation_time.sec
            + feedback.navigation_time.nanosec / 1_000_000_000.0
        )

        with self.lock:
            self.latest_feedback_goal = key
            self.feedback_samples.append((now, key, distance))
            cutoff = now - max(
                self.stuck_window_sec + 5.0,
                self.max_demo_wait_sec + 5.0,
            )
            while self.feedback_samples:
                if self.feedback_samples[0][0] >= cutoff:
                    break
                self.feedback_samples.popleft()

        data = {
            "distance_remaining": distance,
            "navigation_time_sec": finite_float(navigation_time),
            "number_of_recoveries": int(
                feedback.number_of_recoveries
            ),
        }
        self.add_record(
            "/navigate_to_pose/_action/feedback",
            data,
            interval=0.2,
        )

    def diagnostics_callback(self, message):
        levels = [uint8_value(item.level) for item in message.status]
        messages = [
            item.message for item in message.status if item.message
        ][:5]
        data = {
            "max_level": max(levels) if levels else 0,
            "status_count": len(message.status),
            "messages": messages,
        }
        self.add_record("/diagnostics", data, interval=1.0)

    def injection_callback(self, request, response):
        del request
        with self.lock:
            if self.pending_event is not None or self.queued_events:
                response.success = False
                response.message = "当前仍在收集 post_2s，请稍后重试。"
                return response

            self.injection_time = unix_time()
            self.feedback_samples.clear()
            self.reported_events.clear()

        response.success = True
        response.message = (
            "已记录墙体注入时刻，开始 TC-01 异常观察。"
        )
        self.get_logger().info(response.message)
        return response

    def reset_callback(self, request, response):
        del request
        with self.lock:
            if self.pending_event is not None or self.queued_events:
                response.success = False
                response.message = (
                    "当前仍在收集 post_2s，暂不允许重置。"
                )
                return response
            self.injection_time = None
            self.last_obstacle_time = None
            self.last_contact_time = None
            self.collision_detected = False
            self.last_contact_names = []
            self.feedback_samples.clear()
            self.queued_events.clear()
            self.reported_events.clear()

        response.success = True
        response.message = "Agent 本轮 TC-01 状态已重置。"
        self.get_logger().info(response.message)
        return response

    def agent_status_callback(self, request, response):
        del request
        with self.lock:
            status = {
                "buffer_records": len(self.pre_buffer),
                "pending_event": self.pending_event is not None,
                "injection_time": self.injection_time,
                "active_status": self.active_status,
                "feedback_samples": len(self.feedback_samples),
                "collision_detected": self.collision_detected,
                "last_contact_time": self.last_contact_time,
                "last_contact_names": list(self.last_contact_names),
                "unsent_files": len(
                    [
                        name
                        for name in os.listdir(self.events_dir)
                        if name.endswith(".json")
                    ]
                ),
            }
        response.success = True
        response.message = json.dumps(status, ensure_ascii=False)
        return response

    def has_recent_obstacle(self, now):
        return (
            self.last_obstacle_time is not None
            and now - self.last_obstacle_time <= 2.0
        )

    def check_stuck(self, now):
        if self.injection_time is None:
            return
        if self.pending_event is not None:
            return
        if self.active_status != 2:
            return
        if self.latest_feedback_goal is None:
            return

        elapsed = now - self.injection_time
        required = self.injection_grace_sec + self.stuck_window_sec
        if elapsed < required:
            return

        key = self.latest_feedback_goal
        start = now - self.stuck_window_sec
        samples = [
            item
            for item in self.feedback_samples
            if item[1] == key and item[0] >= start
        ]
        if len(samples) < 2:
            return
        if samples[-1][0] - samples[0][0] < (
            self.stuck_window_sec - 1.0
        ):
            return

        progress = samples[0][2] - samples[-1][2]
        if (
            progress < self.min_goal_progress_m
            and self.has_recent_obstacle(now)
        ):
            self.get_logger().warning(
                "TC-01 无有效目标进展："
                f"{progress:.3f}m < "
                f"{self.min_goal_progress_m:.3f}m"
            )
            self.trigger_event("navigation_stuck", key)

    def check_timeout(self, now):
        if self.injection_time is None:
            return
        if self.pending_event is not None:
            return
        if self.active_status != 2:
            return
        if now - self.injection_time < self.max_demo_wait_sec:
            return

        key = self.latest_feedback_goal
        if key is None:
            return
        start = now - self.stuck_window_sec
        samples = [
            item
            for item in self.feedback_samples
            if item[1] == key and item[0] >= start
        ]
        if len(samples) < 2:
            return
        if samples[-1][0] - samples[0][0] < (
            self.stuck_window_sec - 1.0
        ):
            return
        progress = samples[0][2] - samples[-1][2]
        if progress >= self.min_goal_progress_m:
            return
        if not self.has_recent_obstacle(now):
            return

        self.trigger_event(
            "navigation_stuck_timeout",
            key,
        )

    def trigger_event(self, event_type, internal_goal):
        marker = (internal_goal, event_type)
        with self.lock:
            if marker in self.reported_events:
                return

            trigger_time = unix_time()
            pre_5s = [
                item.copy()
                for item in self.pre_buffer
                if (
                    trigger_time - self.pre_window_sec
                    <= item["timestamp"]
                    <= trigger_time
                )
            ]
            event = {
                "event_type": event_type,
                "trigger_time": trigger_time,
                "pre_5s": pre_5s,
                "post_2s": [],
                "internal_goal": internal_goal,
            }
            self.reported_events.add(marker)
            queued = self.pending_event is not None
            if queued:
                self.queued_events.append(event)
            else:
                self.pending_event = event

        if queued:
            self.get_logger().warning(
                f"触发 {event_type}，已排队收集 post_2s。"
            )
        else:
            self.get_logger().warning(
                f"触发 {event_type}，开始收集 post_2s。"
            )

    def timer_callback(self):
        now = unix_time()
        with self.lock:
            pending = self.pending_event

        if pending is not None:
            if now >= pending["trigger_time"] + self.post_window_sec:
                self.finish_pending_event()
            return

        self.check_stuck(now)
        self.check_timeout(now)

    def finish_pending_event(self):
        with self.lock:
            pending = self.pending_event
            if pending is None:
                return
            self.pending_event = (
                self.queued_events.popleft()
                if self.queued_events
                else None
            )

        event = {
            "event_type": pending["event_type"],
            "trigger_time": pending["trigger_time"],
            "robot_id": "tc-01",
            "window": {
                "pre_5s": pending["pre_5s"],
                "post_2s": pending["post_2s"],
            },
            "params_snapshot": dict(self.params_snapshot),
            "static_index_version": "v1",
        }

        try:
            self.validate_event(event)
            path = self.write_json_atomic(
                self.events_dir,
                "event_"
                f"{int(event['trigger_time'] * 1000)}_"
                f"{event['event_type']}.json",
                event,
            )
        except (OSError, TypeError, ValueError) as error:
            self.get_logger().error(f"事件生成失败：{error}")
            return

        self.get_logger().info(f"事件已保存：{path}")
        self.send_queue.put(
            {
                "path": path,
                "endpoint": "/api/ingest/event",
                "move_on_success": True,
            }
        )

    def validate_event(self, event):
        if set(event) != self.EVENT_KEYS:
            raise ValueError("事件顶层字段与 JSON 协议不一致")
        if not isinstance(event["event_type"], str):
            raise TypeError("event_type 必须是字符串")
        if not isinstance(event["trigger_time"], (int, float)):
            raise TypeError("trigger_time 必须是数字")
        if event["robot_id"] != "tc-01":
            raise ValueError("robot_id 必须为 tc-01")
        if set(event["window"]) != self.WINDOW_KEYS:
            raise ValueError("window 字段与 JSON 协议不一致")
        if not isinstance(event["params_snapshot"], dict):
            raise TypeError("params_snapshot 必须是对象")
        if event["static_index_version"] != "v1":
            raise ValueError("static_index_version 必须为 v1")

        for name in ("pre_5s", "post_2s"):
            records = event["window"][name]
            if not isinstance(records, list):
                raise TypeError(f"{name} 必须是列表")
            for record in records:
                if set(record) != self.RECORD_KEYS:
                    raise ValueError(
                        f"{name} 中记录字段与协议不一致"
                    )
                if not isinstance(record["topic"], str):
                    raise TypeError("topic 必须是字符串")
                if not isinstance(
                    record["timestamp"],
                    (int, float),
                ):
                    raise TypeError("timestamp 必须是数字")
                if not isinstance(record["data"], dict):
                    raise TypeError("data 必须是对象")

        json.dumps(event, ensure_ascii=False, allow_nan=False)

    def write_json_atomic(self, directory, filename, payload):
        os.makedirs(directory, exist_ok=True)
        final_path = os.path.join(directory, filename)
        temp_path = final_path + ".tmp"
        with open(temp_path, "w", encoding="utf-8") as stream:
            json.dump(
                payload,
                stream,
                ensure_ascii=False,
                allow_nan=False,
                indent=2,
            )
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_path, final_path)
        return final_path

    def send_initial_params(self):
        self.params_timer.cancel()
        payload = {
            "timestamp": unix_time(),
            "params": dict(self.params_snapshot),
        }
        filename = f"params_{int(payload['timestamp'] * 1000)}.json"
        try:
            path = self.write_json_atomic(
                self.params_dir,
                filename,
                payload,
            )
        except OSError as error:
            self.get_logger().error(f"参数快照保存失败：{error}")
            return
        self.send_queue.put(
            {
                "path": path,
                "endpoint": "/api/ingest/params",
                "move_on_success": False,
            }
        )

    def restore_unsent_events(self):
        for filename in sorted(os.listdir(self.events_dir)):
            if not filename.endswith(".json"):
                continue
            self.send_queue.put(
                {
                    "path": os.path.join(self.events_dir, filename),
                    "endpoint": "/api/ingest/event",
                    "move_on_success": True,
                }
            )

    def http_worker(self):
        session = requests.Session()
        session.headers.update(
            {"Content-Type": "application/json"}
        )
        delays = [1.0, 2.0, 5.0]

        while not self.stop_worker.is_set():
            try:
                task = self.send_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            path = task["path"]
            endpoint = task["endpoint"]
            success = False
            permanent_failure = False

            try:
                with open(path, "r", encoding="utf-8") as stream:
                    payload = json.load(stream)
                if endpoint == "/api/ingest/event":
                    self.validate_event(payload)
            except (OSError, ValueError, TypeError) as error:
                self.get_logger().error(
                    f"待发送 JSON 无效：{path}：{error}"
                )
                permanent_failure = True
                payload = None

            if payload is not None:
                attempts = max(1, self.max_retry_count)
                for attempt in range(attempts):
                    try:
                        response = session.post(
                            self.backend_url + endpoint,
                            json=payload,
                            timeout=self.http_timeout_sec,
                        )
                        if 200 <= response.status_code < 300:
                            self.get_logger().info(
                                f"POST {endpoint} 成功："
                                f"HTTP {response.status_code}"
                            )
                            success = True
                            break
                        if 400 <= response.status_code < 500:
                            self.get_logger().error(
                                f"POST {endpoint} 被拒绝："
                                f"HTTP {response.status_code} "
                                f"{response.text[:300]}"
                            )
                            permanent_failure = True
                            break
                        self.get_logger().warning(
                            f"POST {endpoint} 暂时失败："
                            f"HTTP {response.status_code}"
                        )
                    except requests.RequestException as error:
                        self.get_logger().warning(
                            f"POST {endpoint} 网络失败：{error}"
                        )

                    if attempt + 1 < attempts:
                        delay = delays[min(attempt, len(delays) - 1)]
                        self.stop_worker.wait(delay)

            try:
                if success and task["move_on_success"]:
                    shutil.move(
                        path,
                        os.path.join(
                            self.sent_dir,
                            os.path.basename(path),
                        ),
                    )
                elif permanent_failure and task["move_on_success"]:
                    shutil.move(
                        path,
                        os.path.join(
                            self.failed_dir,
                            os.path.basename(path),
                        ),
                    )
            except OSError as error:
                self.get_logger().error(
                    f"移动发送文件失败：{error}"
                )
            finally:
                self.send_queue.task_done()

    def health_callback(self):
        with self.lock:
            topics = len(self.last_topic_time)
            records = len(self.pre_buffer)
            pending = self.pending_event is not None
            status = self.active_status
        self.get_logger().info(
            "健康状态："
            f"topics={topics}, buffer={records}, "
            f"pending={pending}, nav_status={status}, "
            f"send_queue={self.send_queue.qsize()}"
        )

    def close(self):
        self.stop_worker.set()
        self.worker.join(timeout=2.0)


def main(args=None):
    rclpy.init(args=args)
    node = TraceroAgent()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.close()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
