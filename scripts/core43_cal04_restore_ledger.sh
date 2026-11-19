#!/usr/bin/env bash
set -euo pipefail

ledger_path=${CORE43_CAL04_LEDGER_PATH:?}
workflow_runs="repos/${GITHUB_REPOSITORY}/actions/workflows/core43-cal04-scheduled-dryrun.yml/runs"

for event in schedule workflow_dispatch; do
  gh api --method GET "$workflow_runs" -f "branch=${GITHUB_REF_NAME}" -f "event=${event}" -f status=success -F per_page=30
done | jq -s -e --arg current "$GITHUB_RUN_ID" --arg branch "$GITHUB_REF_NAME" '
  if length != 2 or any(.[]; (.workflow_runs | type) != "array") then
    error("invalid_workflow_run_list")
  else
    [.[].workflow_runs[]
      | select((.id | tostring) != $current and .head_branch == $branch and .conclusion == "success"
        and (.event == "schedule" or .event == "workflow_dispatch"))]
      | max_by([.created_at, .id]) | .id // ""
  end
' -r > "${ledger_path}.run-id"
prior_run=$(cat "${ledger_path}.run-id")

if [[ -z "$prior_run" ]]; then
  if [[ "$GITHUB_EVENT_NAME" != workflow_dispatch || "${CORE43_CAL04_BOOTSTRAP_LEDGER:-false}" != true ]]; then
    echo 'missing_prior_artifact_ledger' >&2
    exit 1
  fi
  echo '{"schema":"core43_cal04_keys_v1","keys":[]}' > "$ledger_path"
  exit 0
fi

restore_dir=$(mktemp -d)
trap 'rm -rf "$restore_dir"' EXIT
gh run download "$prior_run" --repo "$GITHUB_REPOSITORY" --name core43-cal04-readonly-report --dir "$restore_dir"
node - "$restore_dir/core43-cal04-report.json" "$ledger_path" <<'NODE'
const fs = require("node:fs");
const { ledgerFromReport } = require("./scripts/core43_cal04_scheduled_dryrun.cjs");
const [, , reportPath, ledgerPath] = process.argv;
const ledger = ledgerFromReport(JSON.parse(fs.readFileSync(reportPath, "utf8")));
fs.writeFileSync(ledgerPath, JSON.stringify(ledger));
NODE
