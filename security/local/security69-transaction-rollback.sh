#!/usr/bin/env bash
# SECURITY-69: isolated PostgreSQL only. Requires SECURITY-09/verify.sh to have run.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
# verify.sh already applies the candidate revocations in this synthetic database.
# Transactionally recreate the previous grants, verify role access, then ROLLBACK.
db <<'SQL'
BEGIN;
GRANT ALL ON TABLE public.nhl_core43_shadow_inputs,
 public.core43_shadow_readiness_v1, public.core43_shadow_predictions_v1,
 public.core43_shadow_preview_v1, public.nhl_core42_status
 TO anon, authenticated;
DO $$
DECLARE role_name text; obj text; privilege_name text;
BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH obj IN ARRAY ARRAY['nhl_core43_shadow_inputs','core43_shadow_readiness_v1',
   'core43_shadow_predictions_v1','core43_shadow_preview_v1','nhl_core42_status'] LOOP
   FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
    IF NOT has_table_privilege(role_name,'public.'||obj,privilege_name) THEN
     RAISE EXCEPTION 'synthetic pre-revocation grant missing: %, %, %',role_name,obj,privilege_name;
    END IF;
   END LOOP;
  END LOOP;
 END LOOP;
END $;
-- Exercise the actual proposed revocations in the SAME transaction.
REVOKE ALL ON TABLE public.nhl_core43_shadow_inputs FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.core43_shadow_readiness_v1,
 public.core43_shadow_predictions_v1,public.core43_shadow_preview_v1
 FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
 ON TABLE public.nhl_core42_status FROM PUBLIC,anon,authenticated;
DO $$
DECLARE role_name text; obj text;
BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH obj IN ARRAY ARRAY['nhl_core43_shadow_inputs','core43_shadow_readiness_v1',
   'core43_shadow_predictions_v1','core43_shadow_preview_v1'] LOOP
   IF has_table_privilege(role_name,'public.'||obj,'SELECT') THEN
    RAISE EXCEPTION 'internal object still public: %, %',role_name,obj;
   END IF;
  END LOOP;
  IF NOT has_table_privilege(role_name,'public.nhl_core42_status','SELECT')
   OR has_table_privilege(role_name,'public.nhl_core42_status','INSERT') THEN
   RAISE EXCEPTION 'public status permissions wrong: %',role_name;
  END IF;
 END LOOP;
END $$;
ROLLBACK;
SQL
# Transaction rollback must preserve the previously committed restricted baseline.
for role in anon authenticated; do
 for obj in nhl_core43_shadow_inputs core43_shadow_readiness_v1 core43_shadow_predictions_v1 core43_shadow_preview_v1; do
  [[ "$(db -Atqc "SELECT has_table_privilege('$role','public.$obj','SELECT')")" == f ]]
 done
 [[ "$(db -Atqc "SELECT has_table_privilege('$role','public.nhl_core42_status','SELECT')")" == t ]]
 [[ "$(db -Atqc "SELECT has_table_privilege('$role','public.nhl_core42_status','INSERT')")" == f ]]
 for obj in nhl_core43_public_schedule_evidence nhl_core_model_accuracy nhl_core_model_head_to_head nhl_core_model_trend nhl_prediction_archive; do
  [[ "$(db -Atqc "SELECT has_table_privilege('$role','public.$obj','SELECT')")" == t ]]
 done
 db -Atqc "SET ROLE $role; SELECT pending_predictions FROM public.nhl_core42_status" >/dev/null
 if db -Atqc "SET ROLE $role; SELECT * FROM public.core43_shadow_readiness_v1 LIMIT 1" >/dev/null 2>&1; then
  echo "FAIL: internal view readable as $role"; exit 1
 fi
done
echo 'PASS SECURITY-69 transactional grant/revoke rollback and actual-role access in synthetic PostgreSQL'
