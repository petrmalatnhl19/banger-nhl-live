#!/usr/bin/env python3
"""SECURITY-78: offline tracked-file consumer reference inventory; no credentials or network."""
import collections
import os
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
TARGETS = (
    "nhl_core43_shadow_inputs",
    "core43_shadow_readiness_v1",
    "core43_shadow_predictions_v1",
    "core43_shadow_preview_v1",
    "nhl_core42_status",
)
EXCLUDED = {".md", ".lock", ".map", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".pdf", ".zip"}
paths = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
results = collections.defaultdict(list)
scanned = 0
for relative in paths:
    if not relative or relative.startswith(("docs/", ".git/")):
        continue
    path = ROOT / relative
    if path.suffix.lower() in EXCLUDED or not path.is_file() or path.stat().st_size > 2_000_000:
        continue
    try:
        body = path.read_text(encoding="utf-8")
    except (UnicodeError, OSError):
        continue
    scanned += 1
    for name in TARGETS:
        if re.search(r"(?<![A-Za-z0-9_])" + re.escape(name) + r"(?![A-Za-z0-9_])", body):
            results[name].append(relative)
print("SECURITY-78 tracked source reference inventory (not a runtime dependency proof)")
print("Scanned non-doc tracked text files:", scanned)
for name in TARGETS:
    matches = sorted(results[name])
    print(f"{name}: {len(matches)} matching files")
    for match in matches[:50]:
        print("  " + match)
    if len(matches) > 50:
        print(f"  ... {len(matches)-50} more")
print("LIMIT: dynamic queries, external clients, runtime cron/Edge and production metadata are not captured.")
summary = os.environ.get("GITHUB_STEP_SUMMARY")
if summary:
    with open(summary, "a", encoding="utf-8") as out:
        out.write("\n### SECURITY-78: static tracked-source references (not full consumers)\n")
        out.write(f"Scanned {scanned} non-documentation text files.\n\n")
        out.write("| Object | Matching files |\n|---|---:|\n")
        for name in TARGETS:
            out.write(f"| \`{name}\` | {len(results[name])} |\n")
        out.write("\nDynamic/runtime/external consumers remain unverified.\n")
