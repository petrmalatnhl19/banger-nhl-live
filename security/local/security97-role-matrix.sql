-- SECURITY-97: disposable PostgreSQL fixture only, after verify.sh applies local revocation.
-- This is SQL privilege coverage, NOT a PostgREST/JWT/Data API integration test.
DO $security97$
DECLARE actor text; obj text; privilege text;
BEGIN
  FOREACH actor IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH obj IN ARRAY ARRAY[
      'nhl_core43_shadow_inputs','core43_shadow_readiness_v1',
      'core43_shadow_predictions_v1','core43_shadow_preview_v1'
    ] LOOP
      FOREACH privilege IN ARRAY ARRAY[
        'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'
      ] LOOP
        IF has_table_privilege(actor, format('public.%I',obj),privilege) THEN
          RAISE EXCEPTION 'SECURITY-97 % unexpectedly has % on %',actor,privilege,obj;
        END IF;
      END LOOP;
    END LOOP;
    IF NOT has_table_privilege(actor,'public.nhl_core42_status','SELECT') THEN
      RAISE EXCEPTION 'SECURITY-97 public status read missing for %',actor;
    END IF;
    FOREACH privilege IN ARRAY ARRAY[
      'INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ] LOOP
      IF has_table_privilege(actor,'public.nhl_core42_status',privilege) THEN
        RAISE EXCEPTION 'SECURITY-97 status unexpectedly has % for %',privilege,actor;
      END IF;
    END LOOP;
    IF has_function_privilege(actor,'public.capture_core43_shadow_inputs()','EXECUTE') THEN
      RAISE EXCEPTION 'SECURITY-97 public capture EXECUTE for %',actor;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role','public.capture_core43_shadow_inputs()','EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY-97 service capture permission missing';
  END IF;
END;
$security97$;

-- Exercise real SQL roles without modifying any rows.
SET ROLE anon;
SELECT pending_predictions FROM public.nhl_core42_status;
RESET ROLE;
SET ROLE authenticated;
SELECT pending_predictions FROM public.nhl_core42_status;
RESET ROLE;
SELECT 'PASS SECURITY-97 synthetic SQL ACL matrix' AS result;
