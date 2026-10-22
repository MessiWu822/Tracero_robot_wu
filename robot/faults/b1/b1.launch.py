"""B1 S1 simulation only; contains neither Nav2 nor TC01 injector."""
from pathlib import Path
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description():
    tb3 = Path(get_package_share_directory('turtlebot3_gazebo')) / 'launch'
    gazebo = Path(get_package_share_directory('gazebo_ros')) / 'launch'
    world = Path(__file__).with_name('b1.world')

    def include(path, arguments=None, **kwargs):
        return IncludeLaunchDescription(
            PythonLaunchDescriptionSource(str(path)),
            launch_arguments=(arguments or {}).items(), **kwargs)

    return LaunchDescription([
        DeclareLaunchArgument('gui', default_value='true'),
        include(gazebo / 'gzserver.launch.py', {'world': str(world)}),
        include(gazebo / 'gzclient.launch.py', condition=IfCondition(LaunchConfiguration('gui'))),
        include(tb3 / 'robot_state_publisher.launch.py', {'use_sim_time': 'true'}),
        include(tb3 / 'spawn_turtlebot3.launch.py', {'x_pose': '0.0', 'y_pose': '0.0'}),
    ])
