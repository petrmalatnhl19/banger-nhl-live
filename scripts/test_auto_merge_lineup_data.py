import unittest
from scripts.auto_merge_lineup_data import eligible, REPO, BRANCH, TITLE, REQUIRED

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
