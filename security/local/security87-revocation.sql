-- SECURITY-85/86/87. Run only in the disposable PostgreSQL 17 fixture.
CREATE TEMP VIEW security87_acl AS
SELECT c.relname, x.grantor, x.grantee, x.privilege_type, x.is_grantable
FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) x
WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN (
  'nhl_core43_shadow_inputs', 'core43_shadow_readiness_v1',
  'core43_shadow_predictions_v1', 'core43_shadow_preview_v1', 'nhl_core42_status'
);
CREATE TEMP TABLE security87_original_acl AS TABLE security87_acl;

BEGIN;
-- verify.sh leaves the fixture restricted. Reconstruct the observed grants in this transaction.
GRANT ALL ON TABLE public.nhl_core43_shadow_inputs, public.core43_shadow_readiness_v1,
  public.core43_shadow_predictions_v1, public.core43_shadow_preview_v1,
  public.nhl_core42_status TO anon, authenticated, service_role;
ALTER ROLE service_role BYPASSRLS;
CREATE TEMP TABLE security87_baseline AS TABLE security87_acl;

-- Catch only the expected SQLSTATE. A missing object, invalid statement or
-- unexpectedly successful operation must fail the rehearsal.
CREATE FUNCTION pg_temp.expect_insufficient_privilege(statement text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $test$
BEGIN
  EXECUTE statement;
  RAISE EXCEPTION 'unexpected success: %', statement;
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END;
$test$;

DO $test$
DECLARE public_role text;
BEGIN
  FOREACH public_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', public_role);
    IF NOT has_table_privilege(current_user, 'public.nhl_core43_shadow_inputs', 'SELECT')
       OR (SELECT count(*) FROM public.nhl_core43_shadow_inputs) <> 0 THEN
      RAISE EXCEPTION 'expected RLS to hide seeded rows for %', current_user;
    END IF;
    PERFORM pg_temp.expect_insufficient_privilege(
      'INSERT INTO public.nhl_core43_shadow_inputs(game_id, side) VALUES (82001, ''away'')');
    IF NOT EXISTS (SELECT FROM public.core43_shadow_predictions_v1
                   WHERE game_id = 1 AND core43_away IS NOT NULL) THEN
      RAISE EXCEPTION 'owner-rights synthetic prediction did not retain its baseline output';
    END IF;
    RESET ROLE;
  END LOOP;
END;
$test$;

-- Candidate scope. MAINTAIN is explicit on status for the PostgreSQL 17 ACL.
REVOKE ALL ON TABLE public.nhl_core43_shadow_inputs, public.core43_shadow_readiness_v1,
  public.core43_shadow_predictions_v1, public.core43_shadow_preview_v1
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.nhl_core42_status FROM PUBLIC, anon, authenticated;

DO $test$
DECLARE public_role text; target text; privilege_name text;
BEGIN
  FOREACH public_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', public_role);
    FOREACH target IN ARRAY ARRAY[
      'nhl_core43_shadow_inputs','core43_shadow_readiness_v1',
      'core43_shadow_predictions_v1','core43_shadow_preview_v1'
    ] LOOP
      PERFORM pg_temp.expect_insufficient_privilege(format('SELECT * FROM public.%I', target));
    END LOOP;
    FOREACH privilege_name IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      IF has_table_privilege(current_user, 'public.nhl_core42_status', privilege_name) THEN
        RAISE EXCEPTION 'status privilege % survived for %', privilege_name, current_user;
      END IF;
    END LOOP;
    PERFORM pg_temp.expect_insufficient_privilege(
      'INSERT INTO public.nhl_core43_shadow_inputs(game_id, side) VALUES (82001, ''away'')');
    PERFORM pg_temp.expect_insufficient_privilege('TRUNCATE public.nhl_core43_shadow_inputs');
    PERFORM pg_temp.expect_insufficient_privilege('UPDATE public.nhl_prediction_archive SET status = ''final'' WHERE game_id = 1');
    PERFORM pg_temp.expect_insufficient_privilege('DELETE FROM public.nhl_prediction_archive WHERE game_id = 1');
    PERFORM pg_temp.expect_insufficient_privilege('SELECT public.capture_core43_shadow_inputs()');
    IF NOT EXISTS (SELECT FROM public.nhl_prediction_archive WHERE game_id = 1)
       OR NOT EXISTS (SELECT FROM public.nhl_core43_public_schedule_evidence WHERE game_id = 1)
       OR NOT EXISTS (SELECT FROM public.nhl_core42_status) THEN
      RAISE EXCEPTION 'required public rows absent for %', current_user;
    END IF;
    PERFORM * FROM public.nhl_core_model_accuracy;
    PERFORM * FROM public.nhl_core_model_head_to_head;
    PERFORM * FROM public.nhl_core_model_trend;
    RESET ROLE;
  END LOOP;
END;
$test$;

-- Experiment on existing fixture functions only. pg_temp is explicit and last.
ALTER FUNCTION public.capture_core43_shadow_inputs() SET search_path TO pg_catalog, pg_temp;
ALTER FUNCTION public.core43_capture_on_core42_insert() SET search_path TO pg_catalog, pg_temp;
GRANT UPDATE (core42_predicted_at) ON TABLE public.nhl_prediction_archive TO service_role;

INSERT INTO public.nhl_prediction_archive (game_id, away_team, home_team, core42_factors)
VALUES (82001, 'DAL', 'BOS', '{"away_goalie":{"nhl_player_id":"SYN-A"},"home_goalie":{"nhl_player_id":"SYN-H"}}'),
       (82002, 'DAL', 'BOS', '{"away_goalie":{"nhl_player_id":"SYN-A"},"home_goalie":{"nhl_player_id":"SYN-H"}}');
INSERT INTO public.nhl_core43_goalie_snapshots (game_id, goalie_id, team_code, situation, fetched_at, gsax, shots_against)
VALUES (82001, 'SYN-A', 'DAL', 'all', now() - interval '2 hours', 1, 40),
       (82001, 'SYN-H', 'BOS', 'all', now() - interval '2 hours', 2, 40);
INSERT INTO public.nhl_core43_starter_evidence (game_id, team_code, goalie_id, evidence_status, source_published_at, verified_at)
SELECT game_id, team, goalie, 'confirmed', now() - interval '2 hours', now() - interval '2 hours'
FROM (VALUES (82001), (82002)) AS games(game_id)
CROSS JOIN (VALUES ('DAL', 'SYN-A'), ('BOS', 'SYN-H')) AS sides(team, goalie);

-- One game models cron/direct capture, the other models the Edge collector's archive update.
ALTER TABLE public.nhl_prediction_archive DISABLE TRIGGER core43_shadow_on_core42;
UPDATE public.nhl_prediction_archive SET core42_predicted_at = now() - interval '1 hour' WHERE game_id = 82001;
ALTER TABLE public.nhl_prediction_archive ENABLE TRIGGER core43_shadow_on_core42;

SET LOCAL ROLE service_role;
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.nhl_core43_shadow_inputs WHERE game_id = 82001) <> 0 THEN
    RAISE EXCEPTION 'direct capture fixture already populated';
  END IF;
  PERFORM public.capture_core43_shadow_inputs();
  IF (SELECT count(*) FROM public.nhl_core43_shadow_inputs WHERE game_id = 82001 AND readiness = 'ready') <> 2
     OR public.capture_core43_shadow_inputs() <> 0 THEN
    RAISE EXCEPTION 'direct capture did not persist both ready sides exactly once';
  END IF;
  UPDATE public.nhl_prediction_archive SET core42_predicted_at = now() - interval '1 hour' WHERE game_id = 82002;
  IF (SELECT count(*) FROM public.nhl_core43_shadow_inputs WHERE game_id = 82002 AND readiness = 'ready') <> 2 THEN
    RAISE EXCEPTION 'archive update trigger did not capture both ready sides';
  END IF;
END;
$test$;
RESET ROLE;

-- Model post-commit rollback using the saved ACL entries, including the grantor.
DO $test$
DECLARE missing record;
BEGIN
  FOR missing IN SELECT * FROM security87_baseline EXCEPT SELECT * FROM security87_acl LOOP
    IF missing.grantor <> (SELECT oid FROM pg_roles WHERE rolname = current_user)
       OR missing.grantee NOT IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated')) THEN
      RAISE EXCEPTION 'rollback encountered grant outside audited fixture scope';
    END IF;
    EXECUTE format('GRANT %s ON TABLE public.%I TO %I%s', missing.privilege_type,
      missing.relname, pg_get_userbyid(missing.grantee),
      CASE WHEN missing.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
  IF EXISTS ((TABLE security87_baseline EXCEPT TABLE security87_acl)
             UNION ALL (TABLE security87_acl EXCEPT TABLE security87_baseline)) THEN
    RAISE EXCEPTION 'reconstructed ACL differs from baseline';
  END IF;
END;
$test$;
ROLLBACK;

DO $test$
BEGIN
  IF EXISTS ((TABLE security87_original_acl EXCEPT TABLE security87_acl)
             UNION ALL (TABLE security87_acl EXCEPT TABLE security87_original_acl)) THEN
    RAISE EXCEPTION 'transaction rollback changed the original fixture ACL';
  END IF;
  IF EXISTS (SELECT FROM public.nhl_prediction_archive WHERE game_id IN (82001,82002)) THEN
    RAISE EXCEPTION 'rehearsal rows survived rollback';
  END IF;
END;
$test$;
SELECT 'PASS SECURITY-85/86/87 synthetic roles, capture and ACL rollback';
