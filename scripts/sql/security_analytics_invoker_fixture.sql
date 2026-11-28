\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.nhl_prediction_archive (id int, visible boolean);
INSERT INTO public.nhl_prediction_archive VALUES (1,true),(2,false);
ALTER TABLE public.nhl_prediction_archive ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.nhl_prediction_archive TO anon,authenticated,service_role;
CREATE POLICY read_archive ON public.nhl_prediction_archive FOR SELECT TO anon,authenticated USING (true);
CREATE VIEW public.nhl_core42_status AS SELECT count(*) AS games FROM public.nhl_prediction_archive;
GRANT SELECT ON public.nhl_core42_status TO anon,authenticated,service_role;
CREATE VIEW public.nhl_core_model_accuracy AS SELECT count(*) AS games FROM public.nhl_prediction_archive;
GRANT SELECT ON public.nhl_core_model_accuracy TO anon,authenticated,service_role;
CREATE VIEW public.nhl_core_model_head_to_head AS SELECT count(*) AS games FROM public.nhl_prediction_archive;
GRANT SELECT ON public.nhl_core_model_head_to_head TO anon,authenticated,service_role;
CREATE VIEW public.nhl_core_model_trend AS SELECT count(*) AS games FROM public.nhl_prediction_archive;
GRANT SELECT ON public.nhl_core_model_trend TO anon,authenticated,service_role;
CREATE TEMP TABLE before_nhl_core42_status AS SELECT * FROM public.nhl_core42_status;
GRANT SELECT ON before_nhl_core42_status TO anon,authenticated,service_role;
CREATE TEMP TABLE before_nhl_core_model_accuracy AS SELECT * FROM public.nhl_core_model_accuracy;
GRANT SELECT ON before_nhl_core_model_accuracy TO anon,authenticated,service_role;
CREATE TEMP TABLE before_nhl_core_model_head_to_head AS SELECT * FROM public.nhl_core_model_head_to_head;
GRANT SELECT ON before_nhl_core_model_head_to_head TO anon,authenticated,service_role;
CREATE TEMP TABLE before_nhl_core_model_trend AS SELECT * FROM public.nhl_core_model_trend;
GRANT SELECT ON before_nhl_core_model_trend TO anon,authenticated,service_role;
\ir security_analytics_invoker_proposal.sql
SET LOCAL ROLE anon;
DO $$ BEGIN
IF (SELECT games FROM public.nhl_core42_status) IS DISTINCT FROM (SELECT games FROM before_nhl_core42_status) THEN RAISE EXCEPTION 'parity failed: anon nhl_core42_status'; END IF;
IF NOT has_table_privilege(current_user,'public.nhl_core42_status','SELECT') OR has_table_privilege(current_user,'public.nhl_core42_status','INSERT') THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
IF (SELECT games FROM public.nhl_core_model_accuracy) IS DISTINCT FROM (SELECT games FROM before_nhl_core_model_accuracy) THEN RAISE EXCEPTION 'parity failed: anon nhl_core_model_accuracy'; END IF;
IF NOT has_table_privilege(current_user,'public.nhl_core_model_accuracy','SELECT') OR has_table_privilege(current_user,'public.nhl_core_model_accuracy','INSERT') THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
IF (SELECT games FROM public.nhl_core_model_head_to_head) IS DISTINCT FROM (SELECT games FROM before_nhl_core_model_head_to_head) THEN RAISE EXCEPTION 'parity failed: anon nhl_core_model_head_to_head'; END IF;
IF NOT has_table_privilege(current_user,'public.nhl_core_model_head_to_head','SELECT') OR has_table_privilege(current_user,'public.nhl_core_model_head_to_head','INSERT') THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
IF (SELECT games FROM public.nhl_core_model_trend) IS DISTINCT FROM (SELECT games FROM before_nhl_core_model_trend) THEN RAISE EXCEPTION 'parity failed: anon nhl_core_model_trend'; END IF;
IF NOT has_table_privilege(current_user,'public.nhl_core_model_trend','SELECT') OR has_table_privilege(current_user,'public.nhl_core_model_trend','INSERT') THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
IF (SELECT games FROM public.nhl_core42_status) IS DISTINCT FROM (SELECT games FROM before_nhl_core42_status) THEN RAISE EXCEPTION 'parity failed: authenticated nhl_core42_status'; END IF;
IF NOT has_table_privilege(current_user,'public.nhl_core42_status','SELECT') OR has_table_privilege(current_user,'public.nhl_core42_status','INSERT') THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
IF (SELECT games FROM public.nhl_core_model_accuracy) IS DISTINCT FROM (SELECT games FROM before_nhl_core_model_accuracy) THEN RAISE EXCEPTION 'parity failed: authenticated nhl_core_model_accuracy'; END IF;
IF NOT has_table_privilege(current_user,'public.nhl_core_model_accuracy','SELECT') OR has_table_privilege(current_user,'public.nhl_core_model_accuracy','INSERT') THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
IF (SELECT games FROM public.nhl_core_model_head_to_head) IS DISTINCT FROM (SELECT games FROM before_nhl_core_model_head_to_head) THEN RAISE EXCEPTION 'parity failed: authenticated nhl_core_model_head_to_head'; END IF;
IF NOT has_table_privilege(current_user,'public.nhl_core_model_head_to_head','SELECT') OR has_table_privilege(current_user,'public.nhl_core_model_head_to_head','INSERT') THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
IF (SELECT games FROM public.nhl_core_model_trend) IS DISTINCT FROM (SELECT games FROM before_nhl_core_model_trend) THEN RAISE EXCEPTION 'parity failed: authenticated nhl_core_model_trend'; END IF;
IF NOT has_table_privilege(current_user,'public.nhl_core_model_trend','SELECT') OR has_table_privilege(current_user,'public.nhl_core_model_trend','INSERT') THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN
IF (SELECT games FROM public.nhl_core42_status) IS DISTINCT FROM (SELECT games FROM before_nhl_core42_status) THEN RAISE EXCEPTION 'parity failed: service_role nhl_core42_status'; END IF;
IF NOT has_table_privilege(current_user,'public.nhl_core42_status','SELECT') OR has_table_privilege(current_user,'public.nhl_core42_status','INSERT') THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
IF (SELECT games FROM public.nhl_core_model_accuracy) IS DISTINCT FROM (SELECT games FROM before_nhl_core_model_accuracy) THEN RAISE EXCEPTION 'parity failed: service_role nhl_core_model_accuracy'; END IF;
IF NOT has_table_privilege(current_user,'public.nhl_core_model_accuracy','SELECT') OR has_table_privilege(current_user,'public.nhl_core_model_accuracy','INSERT') THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
IF (SELECT games FROM public.nhl_core_model_head_to_head) IS DISTINCT FROM (SELECT games FROM before_nhl_core_model_head_to_head) THEN RAISE EXCEPTION 'parity failed: service_role nhl_core_model_head_to_head'; END IF;
IF NOT has_table_privilege(current_user,'public.nhl_core_model_head_to_head','SELECT') OR has_table_privilege(current_user,'public.nhl_core_model_head_to_head','INSERT') THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
IF (SELECT games FROM public.nhl_core_model_trend) IS DISTINCT FROM (SELECT games FROM before_nhl_core_model_trend) THEN RAISE EXCEPTION 'parity failed: service_role nhl_core_model_trend'; END IF;
IF NOT has_table_privilege(current_user,'public.nhl_core_model_trend','SELECT') OR has_table_privilege(current_user,'public.nhl_core_model_trend','INSERT') THEN RAISE EXCEPTION 'ACL mismatch'; END IF;
END $$;
RESET ROLE;
DROP POLICY read_archive ON public.nhl_prediction_archive;
CREATE POLICY read_archive ON public.nhl_prediction_archive FOR SELECT TO anon,authenticated USING (visible);
SET LOCAL ROLE anon;
DO $$ BEGIN
IF (SELECT games FROM public.nhl_core42_status) <> 1 THEN RAISE EXCEPTION 'RLS not enforced'; END IF;
IF (SELECT games FROM public.nhl_core_model_accuracy) <> 1 THEN RAISE EXCEPTION 'RLS not enforced'; END IF;
IF (SELECT games FROM public.nhl_core_model_head_to_head) <> 1 THEN RAISE EXCEPTION 'RLS not enforced'; END IF;
IF (SELECT games FROM public.nhl_core_model_trend) <> 1 THEN RAISE EXCEPTION 'RLS not enforced'; END IF;
END $$;
RESET ROLE;
\ir security_analytics_invoker_rollback.sql
SET LOCAL ROLE anon;
DO $$ BEGIN
IF (SELECT games FROM public.nhl_core42_status) <> 2 THEN RAISE EXCEPTION 'rollback failed'; END IF;
IF (SELECT games FROM public.nhl_core_model_accuracy) <> 2 THEN RAISE EXCEPTION 'rollback failed'; END IF;
IF (SELECT games FROM public.nhl_core_model_head_to_head) <> 2 THEN RAISE EXCEPTION 'rollback failed'; END IF;
IF (SELECT games FROM public.nhl_core_model_trend) <> 2 THEN RAISE EXCEPTION 'rollback failed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
