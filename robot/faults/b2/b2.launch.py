"""Independent B2 S1 scenes; no Nav2, Agent, TC01 injector or B1 launcher."""
from pathlib import Path
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution


def generate_launch_description():
    tb3 = Path(get_package_share_directory('turtlebot3_gazebo')) / 'launch'
    gazebo = Path(get_package_share_directory('gazebo_ros')) / 'launch'

    def include(path, arguments=None, **kwargs):
        return IncludeLaunchDescription(
            PythonLaunchDescriptionSource(str(path)),
            launch_arguments=(arguments or {}).items(), **kwargs)

    return LaunchDescription([
        DeclareLaunchArgument('gui', default_value='true'),
        DeclareLaunchArgument('scene', default_value='open', choices=['open', 'finite']),
        include(gazebo / 'gzserver.launch.py', {
            'world': PathJoinSubstitution([
                str(Path(__file__).parent), LaunchConfiguration('scene'), 'b2.world'])}),
        include(gazebo / 'gzclient.launch.py', condition=IfCondition(LaunchConfiguration('gui'))),
        include(tb3 / 'robot_state_publisher.launch.py', {'use_sim_time': 'true'}),
        include(tb3 / 'spawn_turtlebot3.launch.py', {'x_pose': '0.0', 'y_pose': '0.0'}),
    ])
