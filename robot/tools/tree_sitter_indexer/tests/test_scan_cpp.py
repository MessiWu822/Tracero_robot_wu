import unittest
from pathlib import Path

from scan_cpp import build_index, cpp_parser, scan_file, string_literal, validate


class ScanCppTests(unittest.TestCase):
    def test_string_literal_accepts_concatenated_literals(self):
        self.assertEqual(string_literal('"/local_" "plan"'), "/local_plan")
        self.assertIsNone(string_literal("topic_name"))

    def test_index_keeps_protocol_shape(self):
        payload = {
            "version": "v1",
            "index": build_index(
                [
                    {"topic": "/scan", "kind": "publisher", "file": "a.cpp", "line": 4, "snippet": "publish"},
                    {"parameter": "controller_frequency", "kind": "parameter", "file": "a.cpp", "line": 5, "snippet": "declare"},
                ]
            ),
        }
        validate(payload, "v1")
        self.assertEqual(payload["index"]["/scan"]["publisher"][0]["line"], 4)

    def test_unresolved_topic_uses_empty_index_key(self):
        payload = {
            "version": "v1",
            "index": build_index(
                [{"topic": "", "kind": "publisher", "file": "a.cpp", "line": 4, "snippet": "publish"}]
            ),
        }
        validate(payload, "v1")
        self.assertEqual(payload["index"][""]["publisher"][0]["file"], "a.cpp")

    def test_fixture_is_available_for_tree_sitter_integration(self):
        self.assertTrue((Path(__file__).parent / "fixture.cpp").is_file())

    def test_fixture_topics_and_parameter_are_extracted(self):
        try:
            parser = cpp_parser()
        except RuntimeError as error:
            self.skipTest(str(error))
        fixture = Path(__file__).parent / "fixture.cpp"
        records, skipped = scan_file(fixture, fixture.parent, parser)
        self.assertIn(("/scan", "subscriber"), {(r.get("topic"), r["kind"]) for r in records})
        self.assertIn(("/cmd_vel", "publisher"), {(r.get("topic"), r["kind"]) for r in records})
        self.assertIn(("controller_frequency", "parameter"), {(r.get("parameter"), r["kind"]) for r in records})
        self.assertIn(("", "subscriber"), {(r.get("topic"), r["kind"]) for r in records})
        self.assertTrue(any(item["reason"] == "dynamic_topic" for item in skipped))


if __name__ == "__main__":
    unittest.main()
