"""DATA-09: collector output must not silently claim complete goalie coverage."""
import ast
import pathlib
import unittest

SOURCE = pathlib.Path(__file__).with_name("update_starting_goalies.py")

class GoalieStatusTests(unittest.TestCase):
    def test_collector_has_consistent_status_schema(self):
        tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
        statuses = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Dict):
                for key, value in zip(node.keys, node.values):
                    if isinstance(key, ast.Constant) and key.value == "status":
                        statuses.append(value)
        self.assertTrue(any(isinstance(v, ast.IfExp) and isinstance(v.body, ast.Constant) and v.body.value == "unavailable" and isinstance(v.orelse, ast.Constant) and v.orelse.value == "partial" for v in statuses))
        self.assertTrue(any(isinstance(v, ast.Constant) and v.value == "unavailable" for v in statuses))
        self.assertFalse(any(isinstance(v, ast.Constant) and v.value in ("ok", "source_unavailable", "complete") for v in statuses))

    def test_fallback_error_is_structured(self):
        text = SOURCE.read_text(encoding="utf-8")
        self.assertIn('"sourceErrors":["collector: "', text)
        self.assertIn('"conflicts":[]', text)

if __name__ == "__main__":
    unittest.main()
