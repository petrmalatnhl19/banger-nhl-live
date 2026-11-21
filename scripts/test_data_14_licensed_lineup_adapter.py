import unittest
from datetime import datetime, timezone
from scripts.data_14_licensed_lineup_adapter import adapt_lineup

NOW = datetime(2026, 11, 20, 15, tzinfo=timezone.utc)
POLICY = {"licensed_test": {"automaticReuseAuthorized": True, "allowedHosts": ["data.example.org"]}}
PAYLOAD = {
    "provider": "licensed_test", "sourceUrl": "https://data.example.org/lineups",
    "publishedAt": "2026-11-20T14:00:00Z", "team": "stars", "gameId": "2026020335",
    "rosterValidated": True, "forwards": [
        ["A One", "B Two", "C Three"], ["D Four", "E Five", "F Six"],
        ["G Seven", "H Eight", "I Nine"], ["J Ten", "K Eleven", "L Twelve"]],
    "defense": [["M Thirteen", "N Fourteen"], ["O Fifteen", "P Sixteen"],
                ["Q Seventeen", "R Eighteen"]],
}


class LicensedAdapterTests(unittest.TestCase):
    def check(self, payload=PAYLOAD, policy=POLICY):
        return adapt_lineup(payload, policy, now=NOW)

    def test_accepts_explicitly_licensed_validated_projection(self):
        result = self.check()
        self.assertTrue(result["accepted"])
        self.assertFalse(result["confirmedNextGame"])
        self.assertEqual(result["gameId"], "2026020335")

    def test_disabled_without_permission(self):
        self.assertEqual(self.check(policy={})["reason"], "reuse_not_authorized")

    def test_missing_host_allowlist(self):
        self.assertEqual(self.check(policy={"licensed_test": {"automaticReuseAuthorized": True}})["reason"],
                         "provider_hosts_not_configured")

    def test_blocks_untrusted_host(self):
        self.assertEqual(self.check({**PAYLOAD, "sourceUrl": "https://data.example.org.attacker.test/a"})["reason"],
                         "provider_url_not_allowed")

    def test_blocks_stale_data(self):
        self.assertEqual(self.check({**PAYLOAD, "publishedAt": "2026-11-17T14:00:00Z"})["reason"],
                         "stale_or_future_projection")

    def test_blocks_future_data(self):
        self.assertEqual(self.check({**PAYLOAD, "publishedAt": "2026-11-21T14:00:00Z"})["reason"],
                         "stale_or_future_projection")

    def test_blocks_missing_game(self):
        self.assertEqual(self.check({**PAYLOAD, "gameId": None})["reason"], "missing_game_identity")

    def test_blocks_incomplete_lines(self):
        self.assertEqual(self.check({**PAYLOAD, "forwards": PAYLOAD["forwards"][:3]})["reason"],
                         "incomplete_formation")

    def test_blocks_duplicate_players(self):
        duplicate = [line[:] for line in PAYLOAD["forwards"]]
        duplicate[1][0] = duplicate[0][0]
        self.assertEqual(self.check({**PAYLOAD, "forwards": duplicate})["reason"], "duplicate_player")

    def test_blocks_unverified_roster(self):
        self.assertEqual(self.check({**PAYLOAD, "rosterValidated": False})["reason"],
                         "roster_not_validated")

    def test_blocks_unsupported_confirmation(self):
        self.assertEqual(self.check({**PAYLOAD, "gameConfirmed": True})["reason"],
                         "unsupported_game_confirmation")


if __name__ == "__main__":
    unittest.main()
