"""Offline regression checks for NHL player-name normalization."""
import ast
import re
import unicodedata
import unittest
from pathlib import Path

source=Path("scripts/update_lineups.py").read_text(encoding="utf-8")
tree=ast.parse(source)
node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=="normalize")
module=ast.Module(body=[node],type_ignores=[])
namespace={"re":re,"unicodedata":unicodedata}
exec(compile(ast.fix_missing_locations(module),"<normalize>","exec"),namespace)
normalize=namespace["normalize"]

class NameNormalizationTests(unittest.TestCase):
 def test_accents(self):
  self.assertEqual(normalize("Tim Stützle"),normalize("Tim Stutzle"))
  self.assertEqual(normalize("Juuso Välimäki"),normalize("Juuso Valimaki"))
  self.assertEqual(normalize("Alexis Lafrenière"),normalize("Alexis Lafreniere"))
 def test_distinct_players_stay_distinct(self):
  self.assertNotEqual(normalize("Jacob Slavin"),normalize("Jalen Chatfield"))
  self.assertNotEqual(normalize("Tim Stutzle"),normalize("Shane Pinto"))
 def test_verified_full_name_aliases(self):
  self.assertEqual(normalize("Mikey Eyssimont"),normalize("Michael Eyssimont"))
  self.assertEqual(normalize("William Borgen"),normalize("Will Borgen"))
  self.assertNotEqual(normalize("William Borgen"),normalize("William Nylander"))
  self.assertEqual(normalize("Jacob Slavin"),normalize("Jaccob Slavin"))
  self.assertEqual(normalize("Ivan Stenberg"),normalize("Ivar Stenberg"))
 def test_punctuation(self):
  self.assertEqual(normalize("O’Reilly"),normalize("O'Reilly"))

if __name__=="__main__":unittest.main()
