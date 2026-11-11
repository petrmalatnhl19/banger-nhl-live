import unittest
from scripts.auto_merge_lineup_data import eligible, wait_for_mergeability, REPO, BRANCH, TITLE, REQUIRED

def sample():
    pr = {
        "state": "open", "draft": False, "title": TITLE,
        "head": {"ref": BRANCH, "repo": {"full_name": REPO}},
        "base": {"ref": "main"}, "mergeable": True,
        "mergeable_state": "clean", "changed_files": 1,
    }
    files = [{"filename": "starting_goalies.json", "status": "modified"}]
    checks = [{"name": n, "status": "completed", "conclusion": "success",
               "app": {"slug": "github-actions"}} for n in REQUIRED]
    return pr, files, checks

class TestAutoMerge(unittest.TestCase):
    def test_mergeability_poll_waits_for_github(self):
        states = iter([{"mergeable": None}, {"mergeable": None}, {"mergeable": True}])
        calls = []
        result = wait_for_mergeability(lambda _: next(states), 90, attempts=4,
                                       delay=0, sleep=lambda _: calls.append(1))
        self.assertTrue(result["mergeable"])
        self.assertEqual(len(calls), 2)
    def test_mergeability_poll_does_not_override_conflict(self):
        result = wait_for_mergeability(lambda _: {"mergeable": False}, 90,
                                       attempts=4, delay=0, sleep=lambda _: None)
        self.assertFalse(result["mergeable"])
    def test_mergeability_poll_timeout_fails_closed(self):
        result = wait_for_mergeability(lambda _: {"mergeable": None}, 90,
                                       attempts=2, delay=0, sleep=lambda _: None)
        self.assertIsNone(result["mergeable"])
    def test_valid_data(self):
        self.assertTrue(eligible(*sample())[0])
    def test_html_blocked(self):
        p, f, c = sample()
        f[0]["filename"] = "index.html"
        self.assertFalse(eligible(p, f, c)[0])
    def test_script_blocked(self):
        p, f, c = sample()
        f[0]["filename"] = "scripts/evil.py"
        self.assertFalse(eligible(p, f, c)[0])
    def test_failed_check(self):
        p, f, c = sample()
        c[0]["conclusion"] = "failure"
        self.assertFalse(eligible(p, f, c)[0])
    def test_missing_check(self):
        p, f, c = sample()
        c.pop()
        self.assertFalse(eligible(p, f, c)[0])
    def test_transient_unstable_state_with_successful_checks(self):
        p, f, c = sample()
        p["mergeable_state"] = "unstable"
        self.assertTrue(eligible(p, f, c)[0])
    def test_real_conflict_blocked(self):
        p, f, c = sample()
        p["mergeable"] = False
        p["mergeable_state"] = "dirty"
        self.assertFalse(eligible(p, f, c)[0])
    def test_wrong_branch(self):
        p, f, c = sample()
        p["head"]["ref"] = "another"
        self.assertFalse(eligible(p, f, c)[0])
    def test_deleted_data(self):
        p, f, c = sample()
        f[0]["status"] = "removed"
        self.assertFalse(eligible(p, f, c)[0])
    def test_incomplete_file_list(self):
        p, f, c = sample()
        p["changed_files"] = 101
        self.assertFalse(eligible(p, f, c)[0])

if __name__ == "__main__":
    unittest.main()
