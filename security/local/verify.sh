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
# Check both synthetic goalies have evidence strictly before the prediction.
db -Atqc "SELECT count(*) FROM public.core43_shadow_readiness_v1 WHERE game_id=1 AND readiness='ready'" | grep -qx '2'
# Post-prediction evidence must never make a previously unready game ready.
db -Atqc "INSERT INTO public.nhl_prediction_archive (game_id,core42_predicted_at,game_date,away_team,home_team,core42_factors) VALUES (2,now()-interval '1 hour',current_date,'DAL','BOS','{\"away_goalie\":{\"nhl_player_id\":\"LATE\"}}'::jsonb)"
db -Atqc "INSERT INTO public.nhl_core43_starter_evidence VALUES (2,'DAL','LATE','confirmed',now(),now())"
db -Atqc "INSERT INTO public.nhl_core43_goalie_snapshots VALUES (2,'LATE','DAL','all',now(),1.5,40)"
db -Atqc "SELECT readiness FROM public.core43_shadow_readiness_v1 WHERE game_id=2 AND side='away'" | grep -qx 'missing_pregame_starter_evidence'
echo "PASS readiness time cutoff: post-prediction evidence excluded"
# Exercise production-equivalent CORE43 calculations before applying local revocations.
db -Atqc "SELECT experiment_status FROM public.core43_shadow_predictions_v1 WHERE game_id=1" | grep -qx 'experimental_ready'
db -Atqc "SELECT preview_status FROM public.core43_shadow_preview_v1 WHERE game_id=1" | grep -qx 'provisional_goalies_not_confirmed'
db -Atqc "SELECT core43_away IS NOT NULL AND core43_home IS NOT NULL FROM public.core43_shadow_predictions_v1 WHERE game_id=1" | grep -qx 't'
db -Atqc "SELECT core43_preview_away IS NOT NULL AND core43_preview_home IS NOT NULL FROM public.core43_shadow_preview_v1 WHERE game_id=1" | grep -qx 't'
echo "PASS production-equivalent CORE43 prediction/preview synthetic calculations"
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
# Execute SQL as the actual database role, not just catalog privilege inspection.
for role in anon authenticated; do
  db -Atqc "SET ROLE $role; SELECT pending_predictions FROM public.nhl_core42_status" | grep -qx '1'
  db -Atqc "SET ROLE $role; SELECT away_team || '-' || home_team FROM public.nhl_core43_public_schedule_evidence" | grep -qx 'DAL-BOS'
  # An internal view must reject actual role SELECT after remediation.
  if db -Atqc "SET ROLE $role; SELECT * FROM public.core43_shadow_readiness_v1 LIMIT 1" >/dev/null 2>&1; then
    echo "FAIL: $role can read internal readiness view"; exit 1
  fi
  if db -Atqc "SET ROLE $role; SELECT * FROM public.nhl_core43_shadow_inputs LIMIT 1" >/dev/null 2>&1; then
    echo "FAIL: $role can read internal shadow table"; exit 1
  fi
  echo "PASS actual role SQL: $role public reads allowed, internal reads denied"
done
echo "SECURITY-12 local privilege and two real-view definition tests PASS"
