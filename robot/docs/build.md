# Source build

## Prerequisites

Use Ubuntu 22.04 with ROS 2 Humble. Install the build tools:

~~~bash
sudo apt update
sudo apt install -y \
  git python3-colcon-common-extensions python3-rosdep python3-vcstool \
  ros-humble-gazebo-ros-pkgs ros-humble-slam-toolbox
~~~

Initialize rosdep once per machine:

~~~bash
sudo rosdep init 2>/dev/null || true
rosdep update
~~~

## Fetch, patch, and build

Run from robot/:

~~~bash
./scripts/fetch_upstream.sh
./scripts/apply_patches.sh
./scripts/build.sh
./scripts/smoke_test.sh
~~~

The default workspace is robot/workspace. An absolute workspace path may be
passed as the first argument to each script.

In an offline container where dependencies are already installed, skip only
the rosdep installation step:

~~~bash
SKIP_ROSDEP=1 ./scripts/build.sh
~~~

Before `colcon build`, the build script runs `apply_fault_switches.sh` against
the pinned `turtlebot3_simulations` source. The Docker image runs the same
step while it is built, so the installed `turtlebot3_drive` binary and source
workspace use the same switch-enabled revision.

The steps are intentionally separate so a failed patch is visible before
compilation. Never silently skip a patch that fails against a new revision.

The build script runs rosdep by default. In an existing image where all ROS
dependencies are already installed, use `SKIP_ROSDEP=1 ./scripts/build.sh` to
build without contacting apt repositories.
