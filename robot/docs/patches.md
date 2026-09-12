# Maintaining upstream patches

The manifest pins every upstream repository to the commit used in the working
Docker environment. Patches must apply cleanly to those exact commits.

Check the current patch without changing the source tree:

~~~bash
git -C robot/workspace/src/upstream/turtlebot3 apply --check \
  robot/patches/turtlebot3/0001-adapt-navigation-rviz-to-burger.patch
~~~

After intentionally changing an upstream file, create a reviewable patch:

~~~bash
git -C robot/workspace/src/upstream/turtlebot3 diff --binary > change.patch
~~~

Move the patch into the matching directory, add its base commit and purpose to
the header, and register it in scripts/apply_patches.sh. Keep Tracero-owned
nodes in robot/src instead of embedding them in an upstream patch.

When upgrading upstream, update one repository at a time, reapply all patches,
build the workspace, run the smoke test, and run the Gazebo scenario before
committing the new revision.
