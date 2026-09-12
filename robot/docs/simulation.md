# Gazebo simulation

Set the verified model and domain before starting ROS processes:

~~~bash
export TURTLEBOT3_MODEL=burger
export ROS_DOMAIN_ID=30
source /opt/ros/humble/setup.bash
source robot/workspace/install/setup.bash
~~~

Start Gazebo in terminal 1:

~~~bash
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py
~~~

Start Navigation2 in terminal 2:

~~~bash
ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True map:=$(pwd)/robot/simulation/maps/turtlebot3_map.yaml
~~~

Start the Agent and TC-01 injector in terminals 3 and 4:

~~~bash
ros2 launch tracero_agent agent.launch.py
ros2 run tc01_auto_injector tc01_auto_injector --ros-args -p use_sim_time:=true
~~~

Arm the injector only after Gazebo and Navigation2 are ready:

~~~bash
ros2 service call /tc01/arm std_srvs/srv/Trigger '{}'
~~~

When cmd_vel.linear.x remains above the configured threshold for one second,
the injector places the red wall in the planned route. Inspect or reset it:

~~~bash
ros2 service call /tc01/status std_srvs/srv/Trigger '{}'
ros2 service call /tc01/reset std_srvs/srv/Trigger '{}'
~~~

Verify the essential graph before recording a result:

~~~bash
ros2 topic list | grep -E '^/(cmd_vel|odom|scan|tf)$'
ros2 service list | grep -E '^/tc01/(arm|reset|status)$'
~~~
