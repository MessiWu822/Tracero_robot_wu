#!/usr/bin/env python3
"""Build the Tracero v1 topic-to-source index from C++ ROS 2 sources."""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable


CPP_EXTENSIONS = {".cc", ".cpp", ".cxx", ".h", ".hh", ".hpp", ".hxx"}
EXCLUDED_DIRS = {".git", "build", "install", "log", "test", "tests"}
CALL_KINDS = {
    "create_publisher": "publisher",
    "create_subscription": "subscriber",
}
STRING_TOKEN = re.compile(r'(?:u8|u|U|L)?("(?:\\.|[^"\\])*")')


def cpp_parser() -> Any:
    """Create the parser lazily so JSON-only checks need no native dependency."""
    try:
        import tree_sitter_cpp
        from tree_sitter import Language, Parser
    except ImportError as error:
        raise RuntimeError(
            "Missing tree-sitter dependencies. Run: pip install -r requirements.txt"
        ) from error

    language = Language(tree_sitter_cpp.language())
    return Parser(language)


def descendants(node: Any) -> Iterable[Any]:
    yield node
    for child in node.children:
        yield from descendants(child)


def node_text(source: bytes, node: Any) -> str:
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


def call_name(source: bytes, call: Any) -> str | None:
    function = call.child_by_field_name("function")
    if function is None:
        return None
    text = node_text(source, function)
    for name in CALL_KINDS:
        if re.search(rf"(?:^|[.>:]){name}(?:<.*>)?$", text, re.DOTALL):
            return name
    return None


def string_literal(text: str) -> str | None:
    """Return a statically resolvable C++ string literal expression, if any."""
    tokens = STRING_TOKEN.findall(text)
    if not tokens:
        return None
    remainder = STRING_TOKEN.sub("", text)
    if remainder.strip():
        return None
    try:
        return "".join(ast.literal_eval(token) for token in tokens)
    except (SyntaxError, ValueError):
        return None


def source_location(path: Path, root: Path, lines: list[str], node: Any) -> dict[str, Any]:
    line = node.start_point[0] + 1
    return {
        "file": str(path.relative_to(root)).replace("\\", "/"),
        "line": line,
        "snippet": lines[line - 1].strip(),
    }


def call_arguments(call: Any) -> list[Any]:
    arguments = call.child_by_field_name("arguments")
    if arguments is None:
        arguments = next((child for child in call.children if child.type == "argument_list"), None)
    return list(arguments.named_children) if arguments is not None else []


def scan_file(path: Path, root: Path, parser: Any) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    source = path.read_bytes()
    lines = source.decode("utf-8", errors="replace").splitlines()
    tree = parser.parse(source)
    records: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    for node in descendants(tree.root_node):
        if node.type != "call_expression":
            continue
        name = call_name(source, node)
        if name is None:
            continue
        arguments = call_arguments(node)
        topic = string_literal(node_text(source, arguments[0])) if arguments else None
        location = source_location(path, root, lines, node)
        if topic is None:
            # The v1 contract represents an unresolved source topic with an empty key.
            topic = ""
            skipped.append({"kind": CALL_KINDS[name], "reason": "dynamic_topic", **location})
        records.append({"topic": topic, "kind": CALL_KINDS[name], **location})

        if name != "declare_parameter":
            continue

    for node in descendants(tree.root_node):
        if node.type != "call_expression":
            continue
        function = node.child_by_field_name("function")
        if function is None or not re.search(r"(?:^|[.>:])declare_parameter(?:<.*>)?$", node_text(source, function), re.DOTALL):
            continue
        arguments = call_arguments(node)
        parameter = string_literal(node_text(source, arguments[0])) if arguments else None
        location = source_location(path, root, lines, node)
        if parameter is None:
            skipped.append({"kind": "parameter", "reason": "dynamic_parameter", **location})
        else:
            records.append({"parameter": parameter, "kind": "parameter", **location})
    return records, skipped


def build_index(records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    topics: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    parameters: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        location = {key: record[key] for key in ("file", "line", "snippet")}
        if record["kind"] in {"publisher", "subscriber"}:
            topics[record["topic"]][record["kind"]].append(location)
        else:
            parameters[record["parameter"]].append(location)

    index: dict[str, Any] = {}
    for topic in sorted(topics):
        entry: dict[str, Any] = {}
        for kind, locations in topics[topic].items():
            # Publisher/subscriber values are always arrays, including one result.
            entry[kind] = locations
        index[topic] = entry
    if parameters:
        index["$parameters"] = {name: parameters[name] for name in sorted(parameters)}
    return index


def cpp_files(root: Path, include_tests: bool = False) -> Iterable[Path]:
    for path in sorted(root.rglob("*")):
        relative_parts = path.relative_to(root).parts[:-1]
        if not include_tests and any(part in EXCLUDED_DIRS for part in relative_parts):
            continue
        if path.is_file() and path.suffix.lower() in CPP_EXTENSIONS:
            yield path


def scan(roots: Iterable[Path], version: str, include_tests: bool = False) -> dict[str, Any]:
    parser = cpp_parser()
    records: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    scanned_roots: list[str] = []
    for root in roots:
        resolved = root.resolve()
        if not resolved.is_dir():
            raise ValueError(f"Source root does not exist: {root}")
        scanned_roots.append(str(resolved))
        for path in cpp_files(resolved, include_tests=include_tests):
            file_records, file_skipped = scan_file(path, resolved, parser)
            records.extend(file_records)
            skipped.extend(file_skipped)
    return {
        "version": version,
        "index": build_index(records),
        "scan_metadata": {
            "roots": scanned_roots,
            "include_tests": include_tests,
            "skipped": skipped,
        },
    }


def validate(payload: dict[str, Any], version: str) -> None:
    if payload.get("version") != version or not isinstance(payload.get("index"), dict):
        raise ValueError("Index must contain the requested version and an object index")
    for topic, entry in payload["index"].items():
        if topic == "$parameters":
            continue
        if not isinstance(topic, str) or not isinstance(entry, dict):
            raise ValueError(f"Invalid topic entry: {topic}")
        for role in ("publisher", "subscriber"):
            locations = entry.get(role)
            if locations is not None:
                if not isinstance(locations, list):
                    raise ValueError(f"{role} must be an array for {topic}")
                for location in locations:
                    if not {"file", "line", "snippet"} <= set(location):
                        raise ValueError(f"Invalid {role} location for {topic}")


def main() -> int:
    argument_parser = argparse.ArgumentParser(description=__doc__)
    argument_parser.add_argument("--root", action="append", required=True, type=Path)
    argument_parser.add_argument("--output", required=True, type=Path)
    argument_parser.add_argument("--version", default="v1")
    argument_parser.add_argument(
        "--include-tests",
        action="store_true",
        help="include source files below test/tests directories",
    )
    args = argument_parser.parse_args()

    payload = scan(args.root, args.version, include_tests=args.include_tests)
    validate(payload, args.version)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Indexed {len(payload['index'])} entries into {args.output}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(2)
