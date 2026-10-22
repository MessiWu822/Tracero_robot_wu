# B1/B2 in the existing turtlebot3_src container

B1 and B2 are built in the original container. No new Docker container
or complete image rebuild is required. See the Chinese operator guide at
../../../../fault_B1.md in the Windows Tracero folder.
The B2-specific operator guide is ../../../../fault_B2.md.

Run from two terminals inside turtlebot3_src:

```bash
# Terminal 1: isolated Gazebo, Burger starts at (0,0), fixed visible obstacle.
bash /root/workspace/tracero_b1/scripts/launch_b1_simulation.sh

# Terminal 2: one mode at a time.
bash /root/workspace/tracero_b1/scripts/run_b1.sh clean
bash /root/workspace/tracero_b1/scripts/run_b1.sh fault

# B2 has its own workspace and Gazebo port.
bash /root/workspace/tracero_b2/scripts/launch_b2_simulation.sh
bash /root/workspace/tracero_b2/scripts/run_b2.sh clean
bash /root/workspace/tracero_b2/scripts/run_b2.sh fault
```

The runner defaults to clean if no mode is supplied. Only the matching
environment variable enables a source fault; unset, empty, and 0 use the
correct expression. B2 changes only the `inf` fallback in `scan_callback`:
`range_max` becomes `0.0`.
Stop both the driver and Gazebo, and relaunch Gazebo between cases.

## Source and build

The pinned commit a35a56c8b04877dc89772b598084d8ce648a9023 uses
`scan_data_[num] = msg->range_max` in `scan_callback`. B2 replaces that one
expression at build time and leaves the correct expression as the default.

The faulty 30 rad threshold is compared against the difference of two yaw
values bounded approximately by [-pi,pi]. It can never be reached. This
fault traps the turn state; it does not stop after five revolutions. The
initial zero-valued scan cache may trigger a turn before the first scan.

Original source/install remain under /root/turtlebot3_ws. A copied gazebo
package is modified and built under /root/workspace/tracero_b1/ws for B1 and
/root/workspace/tracero_b2/ws for B2.
Rebuild B2 if needed:

```bash
bash /root/workspace/tracero_b2/scripts/build_b2_existing.sh
```

B1 uses ROS domain 31 and Gazebo master port 11346; B2 uses domain 32 and port
11347. Original TC01 ordinarily
uses domain 30 and port 11345. B1 launches neither Nav2 nor the TC01 injector.
The driver runner checks the selected binary contains the switch and refuses
to start if another cmd_vel publisher exists in its domain.

## Verification

Two clean/fault/recovery suites passed in headless Gazebo on 2026-10-06.
Each case ran for 18 simulation seconds, saving bags, topic samples and logs.
They validate functionality; 20-run stability statistics and on-screen GUI
checks are still pending. Evidence directories:

- /root/workspace/tracero_b1/logs/verification_20261006_004153
- /root/workspace/tracero_b1/logs/verification_20261006_004420

First suite: clean displacement 4.7566m, faulty displacement 0.000525m with
24.8035rad cumulative rotation, recovery displacement 4.8585m. Each case had
only turtlebot3_drive_node publishing cmd_vel.

The source transformation checks are also available:

```bash
python3 robot/scripts/test_fault_switches.py
python3 robot/scripts/test_b2_fault_switch.py
```

## Extending the registry

B1 is runtime validated and B2 has the same source-injection/build/run path.
Other IDs in faults/faults.yaml are planned interfaces, not working fault
implementations. Source faults require a matching source consumer.
Parameter/model/integration faults require a launcher selecting the relevant
configurations. Registration alone is not an implementation.
