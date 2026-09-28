#!/usr/bin/env python3
"""Deep-merge a small TC-01 Nav2 overlay into an upstream params file."""

import copy
import sys

import yaml


def merge(base, overlay):
    if not isinstance(base, dict) or not isinstance(overlay, dict):
        return copy.deepcopy(overlay)
    result = copy.deepcopy(base)
    for key, value in overlay.items():
        result[key] = merge(result[key], value) if key in result else copy.deepcopy(value)
    return result


def main(argv):
    if len(argv) != 4:
        raise SystemExit("usage: merge_nav2_params.py BASE OVERLAY OUTPUT")
    with open(argv[1], encoding="utf-8") as stream:
        base = yaml.safe_load(stream) or {}
    with open(argv[2], encoding="utf-8") as stream:
        overlay = yaml.safe_load(stream) or {}
    with open(argv[3], "w", encoding="utf-8") as stream:
        yaml.safe_dump(merge(base, overlay), stream, sort_keys=False, allow_unicode=True)


if __name__ == "__main__":
    main(sys.argv)
