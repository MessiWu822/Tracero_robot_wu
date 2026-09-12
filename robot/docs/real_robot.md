# TurtleBot3 Burger configuration

This procedure assumes Ubuntu 22.04 and ROS 2 Humble on the robot computer.
Gazebo and the TC-01 injector are simulation-only and must not run on the
physical robot.

## Environment

Set the same ROS domain on the robot and operator computers:

~~~bash
export TURTLEBOT3_MODEL=burger
export ROS_DOMAIN_ID=30
source /opt/ros/humble/setup.bash
source robot/workspace/install/setup.bash
~~~

Check that OpenCR is visible and the current user can access it:

~~~bash
ls -l /dev/ttyACM0
groups
~~~

Use the official TurtleBot3 e-Manual for OpenCR firmware and hardware setup.
Do not copy simulation parameters to the physical base without checking wheel
radius, wheel separation, lidar model, and serial port.

## Bringup and verification

Start the base:

~~~bash
ros2 launch turtlebot3_bringup robot.launch.py
~~~

Before enabling navigation, verify the sensor and transform streams:

~~~bash
ros2 topic hz /scan
ros2 topic hz /odom
ros2 run tf2_ros tf2_echo odom base_footprint
~~~

Start tracero_agent only after the robot graph is healthy. Override
backend_url in src/tracero_agent/config/agent.yaml or with a ROS parameter.
Keep credentials outside the repository.
