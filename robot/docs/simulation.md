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

Start the TC-01 Navigation2 profile in terminal 2. This merges a small overlay
into the installed Burger parameters and uses a behavior tree without spin,
backup, wait, or costmap-clearing recovery actions:

~~~bash
robot/simulation/scripts/launch_tc01_navigation.sh \
  "$(pwd)/robot/simulation/maps/turtlebot3_map_v2.yaml"
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
the injector places the red wall in the planned route and notifies the Agent
of the successful spawn time. Inspect or reset it:

~~~bash
ros2 service call /tc01/status std_srvs/srv/Trigger '{}'
ros2 service call /tc01/reset std_srvs/srv/Trigger '{}'
~~~

The wall's visible portion remains 0.50 m high, but its physical collision rail
is only 0.12 m high. The TC-01 Nav2 overlay disables the local and global
dynamic obstacle/voxel layers, so the injected wall is not used for avoidance;
the static map remains active and the chassis/wheels make real physical contact.
It also caps the DWB angular speed at 0.01 rad/s so the robot approaches the
wall directly. Inspect the contact stream in terminal 5:

~~~bash
ros2 topic echo /tc01/bumper_states
~~~

Expected result after contact:

1. `/tc01/bumper_states` contains at least one contact state;
2. the robot stops making odometry progress;
3. the progress checker fails after about 0.5 seconds;
4. the no-recovery behavior tree propagates failure;
5. `/navigate_to_pose/_action/status` reaches `6` (`ABORTED`);
6. the Agent emits `navigation_collision`, followed by
   `navigation_failed` when the action abort is observed.

If the robot still rotates, confirm Nav2 was started with
`launch_tc01_navigation.sh`, rather than the stock launch command, and verify
`FollowPath.max_vel_theta=0.01` plus both `obstacle_layer.enabled=false` and
`voxel_layer.enabled=false`. Do not cancel the action when validating ABORTED;
cancellation produces status 5 instead.

Verify the essential graph before recording a result:

~~~bash
ros2 topic list | grep -E '^/(cmd_vel|odom|scan|tf|tc01/bumper_states)$'
ros2 service list | grep -E '^/tc01/(arm|reset|status)$'
~~~

Record the contact evidence together with the existing TC-01 topics:

~~~bash
ros2 bag record --include-hidden-topics \
  /scan /odom /cmd_vel /local_costmap/costmap /plan \
  /tc01/bumper_states \
  /navigate_to_pose/_action/status \
  /navigate_to_pose/_action/feedback
~~~
