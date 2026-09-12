# Tracero Tree-sitter Indexer

This offline scanner produces the real `static_index_v1.json` used by
`POST /api/ingest/static_index`. It reads the exact Nav2 and TurtleBot3
sources in the Docker image, so every emitted `file`, `line`, and `snippet`
is derived from that image rather than copied from the protocol example.

## Scope

- C++ `create_publisher` calls with literal topic names
- C++ `create_subscription` calls with literal topic names
- C++ `declare_parameter` calls with literal parameter names
- source line and snippet for each discovery

By default, source files below `.git`, `build`, `install`, `log`, `test`, and
`tests` directories are excluded so runtime lookups do not return test-only
publishers. Pass `--include-tests` only when producing a broader audit index.

Topic or parameter expressions that cannot be resolved statically are not
guessed. An unresolved topic is indexed under the empty topic key `""` and is
also recorded in `scan_metadata.skipped` with `dynamic_topic`.
Resolvable topic names are kept exactly as written in source; ROS 2 relative
names such as `cmd_vel` are valid and are not rewritten to `/cmd_vel`.

The output preserves the existing v1 shape for a single occurrence:

```json
{
  "version": "v1",
  "index": {
    "/scan": {
      "publisher": [{"file": "src/example.cpp", "line": 42, "snippet": "..."}]
    }
  }
}
```

`publisher` and `subscriber` are always arrays, including when only one source
location exists, so no source location is discarded.
Parameter declarations live under `index["$parameters"]`.

## Run in the source workspace

Copy this directory into the existing image or mount it outside the source
workspaces. Inside the container:

```bash
cd robot/tools/tree_sitter_indexer
python3 -m pip install --user -r requirements.txt

python3 scan_cpp.py \
  --root ../../workspace/src/upstream/navigation2 \
  --root ../../workspace/src/upstream/turtlebot3 \
  --version v1 \
  --output ../../workspace/static_index_v1.json

python3 -m json.tool \
  ../../workspace/static_index_v1.json >/dev/null
```

Run a focused MVP scan before the full scan when validating the parser:

```bash
python3 scan_cpp.py \
  --root ../../workspace/src/upstream/navigation2/nav2_controller \
  --version v1 \
  --output /tmp/static_index_v1.nav2_controller.json
```

Do not upload the JSON until the listed locations have been spot-checked in
the same source tree. The output version must remain `v1` because the Agent
events already use `static_index_version=v1`.

## Test

```bash
python3 -m unittest discover -s tests -v
```

With the dependencies installed, add an integration run against
`tests/fixture.cpp` or a focused Nav2 package before scanning both workspaces.
