# TC-01 automatic injector

This ROS 2 node arms a repeatable Gazebo fault scenario. After arming, it waits
until the commanded forward velocity remains above the threshold, then spawns
the packaged red wall through gazebo_msgs services.

~~~bash
ros2 run tc01_auto_injector tc01_auto_injector --ros-args -p use_sim_time:=true
ros2 service call /tc01/arm std_srvs/srv/Trigger '{}'
ros2 service call /tc01/status std_srvs/srv/Trigger '{}'
ros2 service call /tc01/reset std_srvs/srv/Trigger '{}'
~~~

Parameters include speed_threshold, hold_seconds, cooldown_seconds, model_file,
entity_name, spawn_x, spawn_y, spawn_z, and event_log. The default model is
installed with the package and the default event log is written below the
current user's local data directory.
