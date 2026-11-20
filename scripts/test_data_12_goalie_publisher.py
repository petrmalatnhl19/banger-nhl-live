"""DATA-12: ensure secondary publisher cannot undo goalie feed status contract."""
import ast
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parent
class PublisherSchemaTests(unittest.TestCase):
 def test_publisher_uses_only_partial_or_unavailable(self):
  tree=ast.parse((ROOT/"publish_rotowire_goalies.py").read_text(encoding="utf-8"))
  assignments=[node for node in ast.walk(tree) if isinstance(node,ast.Assign) and any(
   isinstance(target,ast.Subscript) and isinstance(target.value,ast.Name) and target.value.id=="starters"
   and isinstance(target.slice,ast.Constant) and target.slice.value=="status" for target in node.targets)]
  self.assertEqual(len(assignments),1)
  value=assignments[0].value
  self.assertIsInstance(value,ast.IfExp)
  self.assertEqual({value.body.value,value.orelse.value},{"partial","unavailable"})
 def test_collector_and_publisher_share_schema(self):
  for name in ("update_starting_goalies.py","publish_rotowire_goalies.py"):
   text=(ROOT/name).read_text(encoding="utf-8")
   self.assertNotIn('"status":"ok"',text)
   self.assertNotIn('else "ok"',text)
 def test_publisher_keeps_source_conflicts_and_does_not_upgrade_without_evidence(self):
  text=(ROOT/"publish_rotowire_goalies.py").read_text(encoding="utf-8")
  self.assertIn('starters["conflicts"]',text)
  self.assertIn('preserve_explicit_confirmation(record)',text)
if __name__=="__main__":
 unittest.main()
