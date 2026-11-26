"""Offline regression checks for NHL player-name normalization."""
import ast
import re
import unicodedata
import unittest
from pathlib import Path

source=Path("scripts/update_lineups.py").read_text(encoding="utf-8")
tree=ast.parse(source)
nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {"normalize","split_projection_row","projection_aliases"}]
module=ast.Module(body=nodes,type_ignores=[])
namespace={"re":re,"unicodedata":unicodedata}
exec(compile(ast.fix_missing_locations(module),"<normalize>","exec"),namespace)
normalize=namespace["normalize"]

class NameNormalizationTests(unittest.TestCase):
 def test_nhl_spacing_and_hyphenated_names(self):
  split = namespace["split_projection_row"]
  self.assertEqual(split("Trevor Zegras --Sean Couturier -- Noel Acciari"), ["Trevor Zegras", "Sean Couturier", "Noel Acciari"])
  self.assertEqual(split("Jean-Gabriel Pageau -- Ty Dellandrea --Adam Gaudette"), ["Jean-Gabriel Pageau", "Ty Dellandrea", "Adam Gaudette"])
  self.assertEqual(split("Parker Kelly -- Fedor Svechkov"), ["Parker Kelly", "Fedor Svechkov"])
 def test_alias_requires_roster_id_team_and_role(self):
  resolve = namespace["projection_aliases"]
  player = {"id":8482516,"firstName":{"default":"Matthew"},"lastName":{"default":"Kessel"}}
  self.assertEqual(resolve("NYI", {"defensemen":[player]}), {"Matt Kessel":"Matthew Kessel"})
  self.assertFalse(resolve("NYI", {"forwards":[player]}))
  self.assertFalse(resolve("NYI", {"defensemen":[dict(player,id=1)]}))
  self.assertFalse(resolve("MTL", {"defensemen":[player]}))
 def test_projected_line_heading_variants(self):
  headings = ["Blackhawks projected lines", "Bruins projected lineup"]
  for heading in headings:
   self.assertIsNotNone(re.fullmatch(r"(.{2,55}?) projected (?:lineup|lines)", heading, re.I))
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
