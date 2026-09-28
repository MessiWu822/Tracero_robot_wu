# Tracero TurtleBot3 Humble

This directory reconstructs the working turtlebot3-humble-src-base
development environment without publishing its multi-gigabyte Docker image.
It targets Ubuntu 22.04, ROS 2 Humble, Gazebo Classic 11, Navigation2, and the
TurtleBot3 Burger model.

## Contents

- upstream/turtlebot3-humble.repos pins the verified upstream Git revisions.
- patches contains reviewable changes applied on top of upstream source.
- ../tracero_agent contains the runtime evidence collector from delivery 0.17.
- src/tc01_auto_injector contains the post-0.17 Gazebo fault injector.
- simulation contains the TC-01 wall model, helper scripts, and test maps.
- tools/tree_sitter_indexer contains the post-0.17 source index generator.
- docker contains the reproducible build and runtime definition.
- docs contains build, simulation, real-robot, and patch maintenance guides.

## Quick start with Docker

Run from this directory:

~~~bash
docker compose -f docker/compose.yaml build
docker compose -f docker/compose.yaml run --rm tracero-robot bash
~~~

Inside the container:

~~~bash
ros2 pkg executables tracero_agent
ros2 pkg executables tc01_auto_injector
~~~

For a source build, follow docs/build.md. Simulation and real-robot procedures
are separate because their device and display requirements differ.

For the complete beginner-friendly TC-01 collision procedure, start with
[docs/tc01.md](docs/tc01.md). It assumes the base Windows/WSL2/Docker guide is
finished and documents the exact container paths, build commands, launch order,
manual and automatic injection modes, acceptance evidence, reset procedure, and
troubleshooting.

## Status

The source packages compile in the original ROS 2 Humble development
environment. The Tracero Agent has passed local TC-01 testing; formal Machine
A to Machine B integration remains pending.
