#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
docker compose up -d --wait
# Local-only container, synthetic schema. Do not use any remote database credentials.
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
check() {
  local role="$1" object="$2" expected="$3"
  local actual
  actual="$(db -Atqc "SELECT has_table_privilege('$role','public.$object','SELECT')")"
  if [[ "$actual" != "$expected" ]]; then echo "FAIL: $role $object expected=$expected actual=$actual"; exit 1; fi
  echo "PASS $role $object SELECT=$actual"
}
for role in anon authenticated; do
  check "$role" core43_shadow_readiness_v1 t
  check "$role" core43_shadow_predictions_v1 t
  check "$role" core43_shadow_preview_v1 t
done
echo "Applying SECURITY-06 candidate only to synthetic local database..."
db <<'SQL'
BEGIN;
REVOKE ALL ON TABLE public.nhl_core43_shadow_inputs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.core43_shadow_readiness_v1,public.core43_shadow_predictions_v1,public.core43_shadow_preview_v1 FROM PUBLIC, anon, authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE public.nhl_core42_status FROM PUBLIC,anon,authenticated;
COMMIT;
SQL
for role in anon authenticated; do
  for obj in nhl_core43_shadow_inputs core43_shadow_readiness_v1 core43_shadow_predictions_v1 core43_shadow_preview_v1; do check "$role" "$obj" f; done
  for obj in nhl_core42_status nhl_core43_public_schedule_evidence nhl_core_model_accuracy nhl_core_model_head_to_head nhl_core_model_trend nhl_prediction_archive; do check "$role" "$obj" t; done
done
echo "SECURITY-09 synthetic privilege tests PASS"
