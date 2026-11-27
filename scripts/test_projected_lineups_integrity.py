"""Exercise the actual importer validation block without network access."""
import pathlib
import textwrap
import unittest

SOURCE = pathlib.Path(__file__).with_name("update_lineups.py").read_text(encoding="utf-8")
START = SOURCE.index("  all_rows=original_forwards+original_defense")
END = SOURCE.index("  # Explain rejected lines", START)
VALIDATE = compile(textwrap.dedent(SOURCE[START:END]), "update_lineups.py", "exec")

def validate(f, d, singles):
    team = {"goalies": singles}
    groups = {"forwards": {f"f{i}" for i in range(1,13)},
              "defense": {f"d{i}" for i in range(1,8)}, "goalies": {"g1","g2"}}
    env = dict(team=team, groups=groups, normalize=str.lower,
               original_forwards=f, original_defense=d)
    exec(VALIDATE, env)
    return team

F = [["f1","f2","f3"],["f4","f5","f6"],["f7","f8","f9"]]
D = [["d1","d2"],["d3","d4"],["d5","d6"]]

class Integrity(unittest.TestCase):
    def test_eleven_seven(self):
        t = validate(F,D+[["f10","f11"]],["d7","g1","g2"])
        self.assertEqual(t["projectedAlignment"]["forwards"],11)
        self.assertEqual(t["projectedAlignment"]["defense"],7)
        self.assertEqual(t["projectedAlignment"]["extraDefenders"],["d7"])
        self.assertEqual(t["goalies"],["g1","g2"])
        self.assertEqual(len(t["defense"]),3)
    def test_unknown_player_preserves_verified(self):
        t = validate(F+[["f10","unknown","f12"]],D,["g1"])
        self.assertEqual(t["partialFormations"][0]["verifiedPlayers"],["f10","f12"])
        self.assertNotIn("projectedAlignment",t)
    def test_mixed_role_not_verified_as_forward(self):
        t = validate(F+[["f10","f11","d7"]],D,["g1"])
        self.assertEqual(t["partialFormations"][0]["verifiedPlayers"],["f10","f11"])
        self.assertEqual(len(t["forwards"]),3)
    def test_duplicate_not_eleven_seven(self):
        t = validate(F,D+[["f10","f10"]],["d7","g1"])
        self.assertNotIn("projectedAlignment",t)
    def test_standard(self):
        t = validate(F+[["f10","f11","f12"]],D,["g1"])
        self.assertEqual(len(t["forwards"]),4)
        self.assertEqual(t["partialFormations"],[])
        self.assertNotIn("projectedAlignment",t)

if __name__ == "__main__":
    unittest.main()
