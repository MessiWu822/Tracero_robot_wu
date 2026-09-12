# Third-party notices

The `robot/upstream/turtlebot3-humble.repos` manifest downloads the following
projects at pinned revisions. Their source is not vendored in this repository
and remains governed by the license in each upstream repository.

| Project | Upstream | License |
| --- | --- | --- |
| TurtleBot3 | https://github.com/ROBOTIS-GIT/turtlebot3 | Apache-2.0 |
| TurtleBot3 Messages | https://github.com/ROBOTIS-GIT/turtlebot3_msgs | Apache-2.0 |
| TurtleBot3 Simulations | https://github.com/ROBOTIS-GIT/turtlebot3_simulations | Apache-2.0 |
| DynamixelSDK | https://github.com/ROBOTIS-GIT/DynamixelSDK | Apache-2.0 |
| HLS LFCD LDS Driver | https://github.com/ROBOTIS-GIT/hls_lfcd_lds_driver | Apache-2.0 |
| Navigation2 | https://github.com/ros-navigation/navigation2 | Apache-2.0 |

The files under `robot/patches` describe Tracero-specific changes against the
exact revisions in the manifest. Applying a patch does not replace or remove
the upstream project's copyright and license notices.
