FROM osrf/ros:humble-desktop-full

ARG DEBIAN_FRONTEND=noninteractive

ENV ROS_DISTRO=humble \
    TURTLEBOT3_MODEL=burger \
    ROS_DOMAIN_ID=30 \
    QT_X11_NO_MITSHM=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        git \
        python3-colcon-common-extensions \
        python3-requests \
        python3-rosdep \
        python3-vcstool \
        ros-humble-gazebo-ros-pkgs \
        ros-humble-slam-toolbox \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/tracero_ws

COPY robot/upstream/turtlebot3-humble.repos /tmp/turtlebot3-humble.repos
RUN mkdir -p src/upstream && vcs import src/upstream < /tmp/turtlebot3-humble.repos

COPY robot/patches /tmp/patches
RUN git -C src/upstream/turtlebot3 apply \
      /tmp/patches/turtlebot3/0001-adapt-navigation-rviz-to-burger.patch

COPY tracero_agent/ src/tracero_agent/
COPY robot/src/tc01_auto_injector/ src/tc01_auto_injector/

RUN rosdep update && \
    rosdep install --from-paths src --ignore-src -r -y --rosdistro humble && \
    /bin/bash -lc 'source /opt/ros/humble/setup.bash && colcon build --symlink-install'

COPY robot/docker/entrypoint.sh /tracero_entrypoint.sh
RUN chmod +x /tracero_entrypoint.sh

ENTRYPOINT ["/tracero_entrypoint.sh"]
CMD ["bash"]
