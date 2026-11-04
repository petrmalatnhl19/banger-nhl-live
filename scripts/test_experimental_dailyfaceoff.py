import unittest
from experimental_dailyfaceoff import parse_lines

OTT = """Ottawa Senators NHL Line Combinations
Last updated: 2026-11-03T18:43:19.045Z
Forwards
LW
C
RW
Fabian Zetterlund
Tim Stützle
Dylan Cozens
Philip Tomasino
Shane Pinto
Drake Batherson
Michael Amadio
Ridly Greig
Claude Giroux
Nick Cousins
Stephen Halliday
Sammy Blais
Click player jersey for news, stats and more!
Defensive Pairings
Jake Sanderson
Artem Zub
Thomas Chabot
Jordan Spence
Nikolas Matinpalo
Carter Yakemchuk
Click player jersey for news, stats and more!
Ottawa Senators Team Cap Summary
Cap Summary
2026-27
1st Powerplay Unit
Drake Batherson
Stephen Halliday
Dylan Cozens
Tim Stützle
Jake Sanderson
Click player jersey for news, stats and more!
2nd Powerplay Unit
Ridly Greig
Shane Pinto
Claude Giroux
Fabian Zetterlund
Thomas Chabot
Click player jersey for news, stats and more!
1st Penalty Kill Unit
Shane Pinto
Ridly Greig
Jake Sanderson
Artem Zub
Click player jersey for news, stats and more!
2nd Penalty Kill Unit
Tim Stützle
Michael Amadio
Thomas Chabot
Nikolas Matinpalo
Click player jersey for news, stats and more!
Goalies
Samuel Ersson
Jonas Johansson
Click player jersey for news, stats and more!
Injuries
ir
Linus Ullmark
""".splitlines()

class DailyFaceoffPreviewTests(unittest.TestCase):
 def test_ottawa_chart(self):
  result=parse_lines(OTT,"OTT","https://example.test", "\n".join(OTT))
  self.assertEqual(result["status"],"parsed_unverified_do_not_publish")
  self.assertEqual(len(result["forwards"]),4)
  self.assertEqual(len(result["defense"]),3)
  self.assertEqual(result["forwards"][0],["Fabian Zetterlund","Tim Stützle","Dylan Cozens"])
  self.assertEqual(result["goalies"],["Samuel Ersson","Jonas Johansson"])
  self.assertEqual(len(result["powerplay"]),2)
  self.assertEqual(len(result["penaltykill"]),2)
  self.assertEqual(result["sourceUpdatedAt"],"2026-11-03T18:43:19.045Z")
  self.assertIsNone(result["startingGoalie"])
 def test_missing_line_fails_closed(self):
  lines=OTT.copy()
  lines.remove("Sammy Blais")
  result=parse_lines(lines,"OTT","https://example.test")
  self.assertEqual(result["status"],"incomplete_or_unrecognized")
  self.assertEqual(result["forwards"],[])
 def test_no_goalies_fails_closed(self):
  lines=[s for s in OTT if s not in ("Samuel Ersson","Jonas Johansson")]
  result=parse_lines(lines,"OTT","https://example.test")
  self.assertEqual(result["status"],"incomplete_or_unrecognized")

if __name__=="__main__":unittest.main()
