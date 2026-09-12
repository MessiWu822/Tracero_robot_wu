#!/usr/bin/env python3

import json
import os
import time

from ament_index_python.packages import get_package_share_directory
import rclpy
from rclpy.node import Node

from geometry_msgs.msg import Twist
from gazebo_msgs.srv import DeleteEntity, SpawnEntity
from std_srvs.srv import Trigger


class Tc01AutoInjector(Node):

    def __init__(self):
        super().__init__("tc01_auto_injector")

        self.declare_parameter("speed_threshold", 0.05)
        self.declare_parameter("hold_seconds", 1.0)
        self.declare_parameter("cooldown_seconds", 30.0)

        self.declare_parameter(
            "model_file",
            os.path.join(
                get_package_share_directory("tc01_auto_injector"),
                "models",
                "tc01_wall",
                "model.sdf",
            ),
        )
        self.declare_parameter("entity_name", "tc01_wall")

        self.declare_parameter("spawn_x", 0.60)
        self.declare_parameter("spawn_y", 0.0)
        self.declare_parameter("spawn_z", 0.25)

        self.declare_parameter(
            "event_log",
            "~/.local/share/tracero_agent/"
            "auto_injection_events.jsonl",
        )

        self.speed_threshold = float(
            self.get_parameter("speed_threshold").value
        )
        self.hold_seconds = float(
            self.get_parameter("hold_seconds").value
        )
        self.cooldown_seconds = float(
            self.get_parameter("cooldown_seconds").value
        )

        self.model_file = str(
            self.get_parameter("model_file").value
        )
        self.entity_name = str(
            self.get_parameter("entity_name").value
        )

        self.spawn_x = float(
            self.get_parameter("spawn_x").value
        )
        self.spawn_y = float(
            self.get_parameter("spawn_y").value
        )
        self.spawn_z = float(
            self.get_parameter("spawn_z").value
        )

        self.event_log = os.path.expanduser(str(
            self.get_parameter("event_log").value
        ))

        self.armed = False
        self.injected = False
        self.spawning = False

        self.above_threshold_since = None
        self.last_injection_ros_time = None

        self.spawn_client = self.create_client(
            SpawnEntity,
            "/spawn_entity",
        )
        self.delete_client = self.create_client(
            DeleteEntity,
            "/delete_entity",
        )

        self.create_subscription(
            Twist,
            "/cmd_vel",
            self.cmd_vel_callback,
            10,
        )

        self.create_service(
            Trigger,
            "/tc01/arm",
            self.arm_callback,
        )
        self.create_service(
            Trigger,
            "/tc01/reset",
            self.reset_callback,
        )
        self.create_service(
            Trigger,
            "/tc01/status",
            self.status_callback,
        )

        self.get_logger().info(
            "TC-01 自动注入节点已启动，目前未武装。"
        )
        self.get_logger().info(
            "调用 /tc01/arm 后，linear.x > "
            f"{self.speed_threshold:.3f} m/s 连续 "
            f"{self.hold_seconds:.1f}s 时生成墙体。"
        )

    def ros_time_seconds(self):
        return self.get_clock().now().nanoseconds / 1_000_000_000.0

    def cooldown_remaining(self):
        if self.last_injection_ros_time is None:
            return 0.0

        now = self.ros_time_seconds()
        elapsed = now - self.last_injection_ros_time

        if elapsed < 0:
            self.last_injection_ros_time = None
            return 0.0

        return max(0.0, self.cooldown_seconds - elapsed)

    def cmd_vel_callback(self, message):
        if not self.armed:
            self.above_threshold_since = None
            return

        if self.injected or self.spawning:
            return

        if self.cooldown_remaining() > 0:
            self.above_threshold_since = None
            return

        now = self.ros_time_seconds()

        if message.linear.x > self.speed_threshold:
            if self.above_threshold_since is None:
                self.above_threshold_since = now
                self.get_logger().info(
                    "检测到前进速度超过阈值，开始计时。"
                )
                return

            held_seconds = now - self.above_threshold_since

            if held_seconds >= self.hold_seconds:
                self.begin_injection()
        else:
            self.above_threshold_since = None

    def begin_injection(self):
        if self.spawning or self.injected:
            return

        self.spawning = True
        self.armed = False
        self.above_threshold_since = None

        if not os.path.isfile(self.model_file):
            self.get_logger().error(
                f"找不到墙体模型：{self.model_file}"
            )
            self.spawning = False
            return

        self.get_logger().info(
            "触发条件满足，准备生成 TC-01 墙体。"
        )

        if self.delete_client.service_is_ready():
            request = DeleteEntity.Request()
            request.name = self.entity_name

            future = self.delete_client.call_async(request)
            future.add_done_callback(
                lambda _: self.send_spawn_request()
            )
        else:
            self.send_spawn_request()

    def send_spawn_request(self):
        if not self.spawn_client.service_is_ready():
            self.get_logger().error(
                "/spawn_entity 服务尚未就绪。"
            )
            self.spawning = False
            return

        try:
            with open(
                self.model_file,
                "r",
                encoding="utf-8",
            ) as model_stream:
                model_xml = model_stream.read()
        except OSError as error:
            self.get_logger().error(
                f"读取模型失败：{error}"
            )
            self.spawning = False
            return

        request = SpawnEntity.Request()
        request.name = self.entity_name
        request.xml = model_xml
        request.robot_namespace = ""
        request.reference_frame = "world"

        request.initial_pose.position.x = self.spawn_x
        request.initial_pose.position.y = self.spawn_y
        request.initial_pose.position.z = self.spawn_z
        request.initial_pose.orientation.w = 1.0

        future = self.spawn_client.call_async(request)
        future.add_done_callback(self.spawn_finished)

    def spawn_finished(self, future):
        self.spawning = False

        try:
            response = future.result()
        except Exception as error:
            self.get_logger().error(
                f"调用 /spawn_entity 失败：{error}"
            )
            return

        if not response.success:
            self.get_logger().error(
                f"墙体生成失败：{response.status_message}"
            )
            return

        self.injected = True
        self.last_injection_ros_time = self.ros_time_seconds()

        event = {
            "event": "wall_injected",
            "wall_time_unix": time.time(),
            "ros_time": self.last_injection_ros_time,
            "entity_name": self.entity_name,
            "spawn_x": self.spawn_x,
            "spawn_y": self.spawn_y,
            "spawn_z": self.spawn_z,
            "speed_threshold": self.speed_threshold,
            "hold_seconds": self.hold_seconds,
        }

        self.write_event(event)

        self.get_logger().info(
            "TC-01 墙体生成成功："
            f"({self.spawn_x}, {self.spawn_y}, "
            f"{self.spawn_z})"
        )

    def write_event(self, event):
        event_directory = os.path.dirname(self.event_log)

        if event_directory:
            os.makedirs(event_directory, exist_ok=True)

        try:
            with open(
                self.event_log,
                "a",
                encoding="utf-8",
            ) as event_stream:
                event_stream.write(
                    json.dumps(
                        event,
                        ensure_ascii=False,
                    )
                    + "\n"
                )
        except OSError as error:
            self.get_logger().error(
                f"事件日志写入失败：{error}"
            )

    def arm_callback(self, request, response):
        del request

        if self.injected:
            response.success = False
            response.message = (
                "墙体已经存在，请先调用 /tc01/reset。"
            )
            return response

        remaining = self.cooldown_remaining()

        if remaining > 0:
            response.success = False
            response.message = (
                f"冷却中，还需等待 {remaining:.1f} 秒。"
            )
            return response

        self.armed = True
        self.above_threshold_since = None

        response.success = True
        response.message = (
            "已武装，等待 /cmd_vel.linear.x "
            f"> {self.speed_threshold:.3f} m/s。"
        )

        self.get_logger().info(response.message)
        return response

    def reset_callback(self, request, response):
        del request

        self.armed = False
        self.injected = False
        self.spawning = False
        self.above_threshold_since = None

        if self.delete_client.service_is_ready():
            delete_request = DeleteEntity.Request()
            delete_request.name = self.entity_name
            self.delete_client.call_async(delete_request)

        response.success = True
        response.message = (
            "自动注入状态已重置，并已请求删除墙体。"
        )

        self.get_logger().info(response.message)
        return response

    def status_callback(self, request, response):
        del request

        response.success = True
        response.message = json.dumps(
            {
                "armed": self.armed,
                "injected": self.injected,
                "spawning": self.spawning,
                "cooldown_remaining": round(
                    self.cooldown_remaining(),
                    3,
                ),
                "speed_threshold": self.speed_threshold,
                "hold_seconds": self.hold_seconds,
                "spawn": [
                    self.spawn_x,
                    self.spawn_y,
                    self.spawn_z,
                ],
            },
            ensure_ascii=False,
        )

        return response


def main(args=None):
    rclpy.init(args=args)

    node = Tc01AutoInjector()

    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
