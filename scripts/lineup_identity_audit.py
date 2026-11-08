#!/usr/bin/env python3
"""Cross-check rejected projected player names against current NHL roster.
Never automatically merge players with shared names or infer missing formations.
"""
import json
import re
import unicodedata
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = json.loads((root / "lineups_source_diagnostics.json").read_text(encoding="utf-8"))
rosters = json.loads((root / "nhl_rosters.json").read_text(encoding="utf-8")).get("teams", {})
def norm(s):
    s = unicodedata.normalize("NFKD", str(s).casefold())
    return re.sub(r"[^a-z]", "", "".join(c for c in s if not unicodedata.combining(c)))
report = {"teams": {}, "policy": "Identity audit only; never auto-approve ambiguous or absent players."}
for slug, diagnostic in source.get("teams", {}).items():
    rejected = diagnostic.get("rejectedLines") or []
    if not rejected:
        continue
    roster = rosters.get(slug, {})
    entries = []
    for line in rejected:
        role = "defense" if line.get("group") == "defense" else "forwards"
        for player in line.get("players", []):
            family = norm(str(player).split()[-1])
            candidates = []
            for group in ("forwards", "defense", "goalies"):
                for name in roster.get(group, []):
                    if norm(str(name).split()[-1]) == family:
                        candidates.append({"name": name, "role": group})
            entries.append({
                "sourceName": player, "expectedRole": role,
                "sameSurnameInRoster": candidates,
                "classification": ("ambiguous_same_surname" if len(candidates) > 1
                                   else "possible_name_variant_needs_review" if len(candidates) == 1
                                   else "not_on_current_roster"),
                "automaticApproval": False,
            })
    report["teams"][slug] = {"players": entries}
(root / "lineup_identity_audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
