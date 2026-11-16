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
db -Atqc "INSERT INTO public.nhl_core43_starter_evidence (game_id,team_code,goalie_id,evidence_status,source_published_at,verified_at) VALUES (2,'DAL','LATE','confirmed',now(),now())"
db -Atqc "INSERT INTO public.nhl_core43_goalie_snapshots (game_id,goalie_id,team_code,situation,fetched_at,gsax,shots_against) VALUES (2,'LATE','DAL','all',now(),1.5,40)"
db -Atqc "SELECT readiness FROM public.core43_shadow_readiness_v1 WHERE game_id=2 AND side='away'" | grep -qx 'missing_pregame_starter_evidence'
echo "PASS readiness time cutoff: post-prediction evidence excluded"
# SECURITY-19: exact snapshot GSAx numeric typmod and readiness output signature.
db -Atqc "SELECT format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid='public.nhl_core43_goalie_snapshots'::regclass AND attname='gsax'" | grep -qx 'numeric(12,4)'
db -Atqc "SELECT format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid='public.core43_shadow_readiness_v1'::regclass AND attname='gsax'" | grep -qx 'numeric(12,4)'
echo "PASS SECURITY-19 GSAx numeric(12,4) snapshot and readiness view"
# SECURITY-15: isolated negative cases, all synthetic and marked final so public pending count stays stable.
db <<'SQL'
INSERT INTO public.nhl_prediction_archive (game_id,core42_predicted_at,status,game_date,away_team,home_team,core42_factors) VALUES
(3,now(),'final',current_date,'DAL','BOS','{}'),
(4,now(),'final',current_date,'DAL','BOS','{"away_goalie":{"nhl_player_id":"NOEVID"}}'),
(5,now(),'final',current_date,'DAL','BOS','{"away_goalie":{"nhl_player_id":"LOW"}}'),
(6,now(),'final',current_date,'DAL','BOS','{"away_goalie":{"nhl_player_id":"NOGSAX"}}'),
(7,now()-interval '1 hour','final',current_date,'DAL','BOS','{"away_goalie":{"nhl_player_id":"LATEG"}}'),
(8,now(),'final',current_date,'DAL','BOS','{"away_goalie":{"nhl_player_id":"UNCONF"}}');
INSERT INTO public.nhl_core43_starter_evidence (game_id,team_code,goalie_id,evidence_status,source_published_at,verified_at) VALUES
(5,'DAL','LOW','confirmed',now()-interval '2 hours',now()-interval '2 hours'),
(6,'DAL','NOGSAX','confirmed',now()-interval '2 hours',now()-interval '2 hours'),
(7,'DAL','LATEG','confirmed',now()-interval '2 hours',now()-interval '2 hours'),
(8,'DAL','UNCONF','probable',now()-interval '2 hours',now()-interval '2 hours');
INSERT INTO public.nhl_core43_goalie_snapshots (game_id,goalie_id,team_code,situation,fetched_at,gsax,shots_against) VALUES
(5,'LOW','DAL','all',now()-interval '2 hours',1.5,29),
(6,'NOGSAX','DAL','all',now()-interval '2 hours',NULL,40),
(7,'LATEG','DAL','all',now(),1.5,40),
(8,'UNCONF','DAL','all',now()-interval '2 hours',1.5,40);
SQL
for case in '3:missing_frozen_goalie_id' '4:missing_pregame_starter_evidence' '5:insufficient_shots' '6:missing_gsax' '7:missing_pregame_gsax_snapshot' '8:starter_not_confirmed'; do
  game="${case%%:*}"; expected="${case#*:}"
  actual="$(db -Atqc "SELECT readiness FROM public.core43_shadow_readiness_v1 WHERE game_id=$game AND side='away'")"
  if [[ "$actual" != "$expected" ]]; then echo "FAIL SECURITY-15 game=$game expected=$expected actual=$actual"; exit 1; fi
  echo "PASS SECURITY-15 game=$game readiness=$actual"
done

# Exercise production-equivalent CORE43 calculations before applying local revocations.
db -Atqc "SELECT experiment_status FROM public.core43_shadow_predictions_v1 WHERE game_id=1" | grep -qx 'experimental_ready'
db -Atqc "SELECT preview_status FROM public.core43_shadow_preview_v1 WHERE game_id=1" | grep -qx 'provisional_goalies_not_confirmed'
db -Atqc "SELECT core43_away IS NOT NULL AND core43_home IS NOT NULL FROM public.core43_shadow_predictions_v1 WHERE game_id=1" | grep -qx 't'
db -Atqc "SELECT core43_preview_away IS NOT NULL AND core43_preview_home IS NOT NULL FROM public.core43_shadow_preview_v1 WHERE game_id=1" | grep -qx 't'
echo "PASS production-equivalent CORE43 prediction/preview synthetic calculations"
# SECURITY-16: actual production analytics views, synthetic final result only.
db -Atqc "INSERT INTO public.nhl_prediction_archive (game_id,status,game_date,actual_away,actual_home,baseline_away,baseline_home,advanced_away,advanced_home,goalie32_away,goalie32_home,special33_away,special33_home,core40_away,core40_home,core41_away,core41_home,core42_away,core42_home) VALUES (9,'final',current_date,3,2,3.1,2.1,3.0,2.0,3.2,2.2,3.3,2.3,3.0,2.0,3.0,2.0,3.0,2.0)"
db -Atqc "SELECT count(*) FROM public.nhl_core_model_accuracy WHERE model='CORE 4.2' AND games=1" | grep -qx '1'
db -Atqc "SELECT count(*) FROM public.nhl_core_model_head_to_head WHERE model='CORE 4.1' AND games=1" | grep -qx '1'
db -Atqc "SELECT count(*) FROM public.nhl_core_model_trend WHERE model='CORE 4.2' AND game_id=9 AND games=1" | grep -qx '1'
echo "PASS SECURITY-16 three production analytics views against synthetic final score"
db -Atqc "SELECT 'security_barrier=true'=ANY(reloptions) FROM pg_class WHERE oid='public.nhl_core43_public_schedule_evidence'::regclass" | grep -qx 't'
echo "PASS SECURITY-18 schedule security_barrier matches production"
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
# SECURITY-23: trigger/capture must remain functional after local public-grant revocation.
for role in anon authenticated; do
  db -Atqc "SELECT has_function_privilege('$role','public.capture_core43_shadow_inputs()','EXECUTE')" | grep -qx 'f'
  db -Atqc "SELECT has_function_privilege('$role','public.core43_capture_on_core42_insert()','EXECUTE')" | grep -qx 'f'
done
db -Atqc "SELECT has_function_privilege('service_role','public.capture_core43_shadow_inputs()','EXECUTE')" | grep -qx 't'
db -Atqc "SELECT tgenabled FROM pg_trigger WHERE tgname='core43_shadow_on_core42' AND tgrelid='public.nhl_prediction_archive'::regclass" | grep -qx 'O'
db -Atqc "INSERT INTO public.nhl_prediction_archive (game_id,core42_predicted_at,status,game_date,away_team,home_team,core42_factors) VALUES (23,NULL,'pending',current_date,'DAL','BOS','{\"away_goalie\":{\"nhl_player_id\":\"A\",\"name\":\"Synthetic A\"},\"home_goalie\":{\"nhl_player_id\":\"H\",\"name\":\"Synthetic H\"}}'::jsonb)"
db -Atqc "INSERT INTO public.nhl_core43_starter_evidence (game_id,team_code,goalie_id,evidence_status,source_published_at,verified_at) VALUES (23,'DAL','A','confirmed',now()-interval '2 hours',now()-interval '2 hours'),(23,'BOS','H','confirmed',now()-interval '2 hours',now()-interval '2 hours')"
db -Atqc "UPDATE public.nhl_prediction_archive SET core42_predicted_at=now()-interval '30 minutes' WHERE game_id=23"
db -Atqc "SELECT count(*) FROM public.nhl_core43_shadow_inputs WHERE game_id=23" | grep -qx '2'
db -Atqc "SELECT count(*) FROM public.nhl_core43_shadow_inputs WHERE game_id=23 AND readiness='ready'" | grep -qx '2'
db -Atqc "SELECT public.capture_core43_shadow_inputs()" >/dev/null
db -Atqc "SELECT count(*) FROM public.nhl_core43_shadow_inputs WHERE game_id=23" | grep -qx '2'
for role in anon authenticated; do
  if db -Atqc "SET ROLE $role; SELECT public.capture_core43_shadow_inputs()" >/dev/null 2>&1; then
    echo "FAIL SECURITY-23: $role can directly execute privileged capture"; exit 1
  fi
done
echo "PASS SECURITY-23 owner-privileged capture, trigger, deduplication and role restrictions"
# SECURITY-24: assert synthetic function hardening baseline without changing production.
db -Atqc "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('capture_core43_shadow_inputs','core43_capture_on_core42_insert') AND p.prosecdef AND p.proconfig @> ARRAY['search_path=public']::text[]" | grep -qx '2'
for role in anon authenticated service_role; do
  db -Atqc "SELECT has_schema_privilege('$role','public','CREATE')" | grep -qx 'f'
done
db -Atqc "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('capture_core43_shadow_inputs','core43_capture_on_core42_insert') AND has_function_privilege('service_role',p.oid,'EXECUTE')" | grep -qx '2'
echo "PASS SECURITY-24 function security baseline and schema CREATE restrictions"

# SECURITY-25: isolated search_path hardening test; never change production function settings.
# An untrusted session's temp table must not replace schema-qualified application tables.
db -Atqc "SELECT count(*) FROM public.nhl_core43_shadow_inputs WHERE game_id=23" | grep -qx '2'
db <<'SQL'
BEGIN;
CREATE TEMP TABLE nhl_core43_shadow_inputs (game_id bigint, side text);
SELECT set_config('search_path','pg_temp,public',true);
DO $$
DECLARE captured integer;
BEGIN
  captured := public.capture_core43_shadow_inputs();
  IF captured IS NULL THEN RAISE EXCEPTION 'capture returned null'; END IF;
END $$;
ROLLBACK;
SQL
db -Atqc "SELECT count(*) FROM public.nhl_core43_shadow_inputs WHERE game_id=23" | grep -qx '2'
# Test a candidate stricter search_path locally, then restore the production-equivalent baseline.
db <<'SQL'
BEGIN;
ALTER FUNCTION public.capture_core43_shadow_inputs() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.core43_capture_on_core42_insert() SET search_path = pg_catalog, public, pg_temp;
DO $$
DECLARE captured integer;
BEGIN
  captured := public.capture_core43_shadow_inputs();
  IF captured IS NULL THEN RAISE EXCEPTION 'hardened capture returned null'; END IF;
END $$;
ROLLBACK;
SQL
db -Atqc "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('capture_core43_shadow_inputs','core43_capture_on_core42_insert') AND p.proconfig @> ARRAY['search_path=public']::text[]" | grep -qx '2'
echo "PASS SECURITY-25 temporary shadowing and transactional search_path hardening"

# SECURITY-26: exercise the actual archive UPDATE trigger under hardened function paths.
# The entire fixture is transactional: no permanent function setting or new capture row survives.
db <<'SQL'
BEGIN;
ALTER FUNCTION public.capture_core43_shadow_inputs() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.core43_capture_on_core42_insert() SET search_path = pg_catalog, public, pg_temp;
INSERT INTO public.nhl_prediction_archive
  (game_id,core42_predicted_at,status,game_date,away_team,home_team,core42_factors)
VALUES
  (26,NULL,'pending',current_date,'DAL','BOS',
   '{"away_goalie":{"nhl_player_id":"A","name":"Synthetic A"},"home_goalie":{"nhl_player_id":"H","name":"Synthetic H"}}'::jsonb);
INSERT INTO public.nhl_core43_starter_evidence
  (game_id,team_code,goalie_id,evidence_status,source_published_at,verified_at)
VALUES
  (26,'DAL','A','confirmed',now()-interval '2 hours',now()-interval '2 hours'),
  (26,'BOS','H','confirmed',now()-interval '2 hours',now()-interval '2 hours');
UPDATE public.nhl_prediction_archive
SET core42_predicted_at=now()-interval '30 minutes'
WHERE game_id=26;
DO $security26$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.nhl_core43_shadow_inputs WHERE game_id=26;
  IF n <> 2 THEN RAISE EXCEPTION 'SECURITY-26 expected 2 trigger rows, got %', n; END IF;
  SELECT count(*) INTO n FROM public.nhl_core43_shadow_inputs WHERE game_id=26 AND readiness='ready';
  IF n <> 2 THEN RAISE EXCEPTION 'SECURITY-26 expected 2 ready sides, got %', n; END IF;
  PERFORM public.capture_core43_shadow_inputs();
  SELECT count(*) INTO n FROM public.nhl_core43_shadow_inputs WHERE game_id=26;
  IF n <> 2 THEN RAISE EXCEPTION 'SECURITY-26 duplicate capture, got % rows', n; END IF;
END $security26$;
ROLLBACK;
SQL
db -Atqc "SELECT count(*) FROM public.nhl_core43_shadow_inputs WHERE game_id=26" | grep -qx '0'
db -Atqc "SELECT count(*) FROM public.nhl_prediction_archive WHERE game_id=26" | grep -qx '0'
db -Atqc "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('capture_core43_shadow_inputs','core43_capture_on_core42_insert') AND p.proconfig @> ARRAY['search_path=public']::text[]" | grep -qx '2'
echo "PASS SECURITY-26 hardened trigger capture, readiness, deduplication and rollback"

# SECURITY-27: real SQL execution under untrusted API roles, not only catalog ACL inspection.
for role in anon authenticated; do
  db -Atqc "SELECT has_table_privilege('$role','public.nhl_prediction_archive','UPDATE')" | grep -qx 'f'
  db -Atqc "SELECT has_table_privilege('$role','public.nhl_core43_shadow_inputs','INSERT')" | grep -qx 'f'
  db -Atqc "SELECT has_function_privilege('$role','public.capture_core43_shadow_inputs()','EXECUTE')" | grep -qx 'f'
  db -Atqc "SELECT has_function_privilege('$role','public.core43_capture_on_core42_insert()','EXECUTE')" | grep -qx 'f'
  if db -Atqc "SET ROLE $role; UPDATE public.nhl_prediction_archive SET core42_predicted_at=now() WHERE game_id=23" >/dev/null 2>&1; then
    echo "FAIL SECURITY-27: $role can update archive and potentially fire trigger"; exit 1
  fi
  if db -Atqc "SET ROLE $role; INSERT INTO public.nhl_core43_shadow_inputs (game_id,side) VALUES (2701,'away')" >/dev/null 2>&1; then
    echo "FAIL SECURITY-27: $role can insert shadow inputs"; exit 1
  fi
  if db -Atqc "SET ROLE $role; SELECT public.capture_core43_shadow_inputs()" >/dev/null 2>&1; then
    echo "FAIL SECURITY-27: $role can execute capture"; exit 1
  fi
  if db -Atqc "SET ROLE $role; SELECT public.core43_capture_on_core42_insert()" >/dev/null 2>&1; then
    echo "FAIL SECURITY-27: $role can execute trigger function"; exit 1
  fi
  db -Atqc "SET ROLE $role; SELECT count(*) FROM public.nhl_prediction_archive WHERE game_id=23" | grep -qx '1'
done
db -Atqc "SELECT has_function_privilege('service_role','public.capture_core43_shadow_inputs()','EXECUTE')" | grep -qx 't'
db -Atqc "SELECT has_function_privilege('service_role','public.core43_capture_on_core42_insert()','EXECUTE')" | grep -qx 't'
db -Atqc "SELECT count(*) FROM public.nhl_core43_shadow_inputs WHERE game_id=2701" | grep -qx '0'
db -Atqc "SELECT count(*) FROM public.nhl_core43_shadow_inputs WHERE game_id=23" | grep -qx '2'
echo "PASS SECURITY-27 untrusted role SQL denials, public read compatibility and capture integrity"




echo "SECURITY-12 local privilege and two real-view definition tests PASS"
