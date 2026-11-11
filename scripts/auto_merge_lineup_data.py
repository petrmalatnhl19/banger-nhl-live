#!/usr/bin/env python3
"""Conservative, fail-closed auto-merge of the generated lineup-data PR only."""
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

REPO = "petrmalatnhl19/banger-nhl-live"
BRANCH = "automation/refresh-nhl-lineups"
TITLE = "Automated NHL projected lineups refresh"
REQUIRED = {"frontend-smoke", "browser-smoke"}
ALLOWED = {
    "nhl_news.json", "lineups.json", "lineups_archive.json", "nhl_rosters.json",
    "lineups_coverage.json", "starting_goalies.json", "nhl_goalies.json",
    "rotowire_goalies.json", "rotowire_goalies_diagnostic.json",
    "lineups_changes.json", "lineups_source_diagnostics.json",
    "lineups_discovery_diagnostics.json", "lineup_free_sources_probe.json",
    "lineup_source_usage_report.json", "lineup_core_report.json",
    "lineup_rejections_report.json", "lineup_recovery_plan.json",
    "ottawa_game_roster_diagnostic.json", "dallas_game_roster_diagnostic.json",
    "utah_game_roster_diagnostic.json", "detroit_game_roster_diagnostic.json",
    "lineup_identity_audit.json", "tampa_source_excerpt.json",
}

def eligible(pr, files, checks):
    if pr.get("state") != "open" or pr.get("draft") or pr.get("title") != TITLE:
        return False, "not an open expected data PR"
    if pr.get("head", {}).get("ref") != BRANCH or pr.get("base", {}).get("ref") != "main":
        return False, "unexpected source or target branch"
    if pr.get("head", {}).get("repo", {}).get("full_name") != REPO:
        return False, "unexpected head repository"
    if pr.get("mergeable") is not True:
        return False, "GitHub reports merge conflict or has not calculated mergeability"
    names = [f.get("filename") for f in files]
    if not names or len(names) != pr.get("changed_files") or any(n not in ALLOWED for n in names):
        return False, "changed files outside approved JSON allowlist"
    if any(f.get("status") not in ("modified", "added") for f in files):
        return False, "unexpected file deletion or rename"
    good = {c["name"] for c in checks if c.get("status") == "completed" and c.get("conclusion") == "success" and c.get("app", {}).get("slug") == "github-actions"}
    if not REQUIRED.issubset(good):
        return False, "mandatory CI checks not all successful"
    if any(c.get("conclusion") in ("failure", "cancelled", "timed_out", "action_required") for c in checks):
        return False, "a CI check failed"
    return True, "all guards passed"

def api(path, token, method="GET", payload=None):
    url = "https://api.github.com/repos/" + REPO + path
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "banger-lineups-safe-auto-merge",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.load(response)

def wait_for_mergeability(fetch, number, attempts=8, delay=3, sleep=time.sleep):
    """Poll only while GitHub has not calculated mergeability; never bypass conflicts."""
    for attempt in range(attempts):
        pr = fetch(f"/pulls/{number}")
        if pr.get("mergeable") is not None:
            return pr
        if attempt < attempts - 1:
            sleep(delay)
    return pr


def main():
    read_token = os.environ["GITHUB_TOKEN"]
    write_token = os.environ["LINEUPS_PR_TOKEN"]
    prs = api("/pulls?state=open&per_page=100", read_token)
    matches = [p for p in prs if p.get("head", {}).get("ref") == BRANCH and p.get("base", {}).get("ref") == "main"]
    if len(matches) != 1:
        print("No unique generated data PR; skipping")
        return
    number = matches[0]["number"]
    pr = wait_for_mergeability(lambda path: api(path, read_token), number)
    # GitHub can report mergeable_state=unstable for pending checks even when
    # mergeable=True. Check the required checks explicitly below instead.
    sha = pr["head"]["sha"]
    files = api(f"/pulls/{number}/files?per_page=100", read_token)
    checks = api(f"/commits/{sha}/check-runs?per_page=100", read_token)["check_runs"]
    ok, reason = eligible(pr, files, checks)
    if not ok:
        print("Not merging PR", number, ":", reason)
        return
    # Validate actual generated JSON, not just GitHub's green build.
    for file in files:
        name = file["filename"]
        raw_url = "https://raw.githubusercontent.com/" + REPO + "/" + sha + "/" + name
        req = urllib.request.Request(raw_url, headers={"Authorization": "Bearer " + read_token})
        with urllib.request.urlopen(req, timeout=25) as response:
            json.load(response)
    goalie = api("/contents/rotowire_goalies.json?ref=" + sha, read_token)
    import base64
    feed = json.loads(base64.b64decode(goalie["content"]))
    updated = dt.datetime.fromisoformat(feed["updatedAt"].replace("Z", "+00:00"))
    if updated.tzinfo is None:
        print("Missing feed timezone; skipping")
        return
    age = (dt.datetime.now(dt.timezone.utc) - updated).total_seconds()
    if age < -300 or age > 3 * 3600 or not feed.get("games"):
        print("RotoWire data stale, future-dated, or empty; skipping")
        return
    diagnostic_file = api("/contents/rotowire_goalies_diagnostic.json?ref=" + sha, read_token)
    diagnostic = json.loads(base64.b64decode(diagnostic_file["content"]))
    candidates = diagnostic.get("candidateCount", 0)
    matched = diagnostic.get("matchedCount", 0)
    games = feed["games"]
    if (not isinstance(candidates, int) or not isinstance(matched, int)
            or candidates < 10 or matched < 10 or matched > candidates
            or matched / candidates < 0.75
            or feed.get("goalieCount") != len(games)
            or len(games) < 10 or len(games) > matched):
        print("RotoWire coverage or published record counts invalid; skipping")
        return
    # GitHub rechecks the exact expected head SHA; branch protection still applies.
    result = api(f"/pulls/{number}/merge", write_token, "PUT", {
        "commit_title": "Update verified NHL lineup data",
        "merge_method": "squash",
        "sha": sha,
    })
    print("Merged generated lineup data PR", number, ":", result.get("merged"))

if __name__ == "__main__":
    try:
        main()
    except (KeyError, ValueError, urllib.error.HTTPError, urllib.error.URLError) as error:
        print("Auto-merge blocked:", str(error), file=sys.stderr)
        sys.exit(1)
