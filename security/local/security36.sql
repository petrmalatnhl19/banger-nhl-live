-- SECURITY-36: synthetic PostgreSQL only; all changes rolled back.
BEGIN;
CREATE TABLE public.security36_originals (
 game_id bigint PRIMARY KEY, original_payload jsonb NOT NULL
);
CREATE TABLE public.security36_versions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 game_id bigint NOT NULL REFERENCES public.security36_originals(game_id),
 cutoff_at timestamptz NOT NULL,
 generated_at timestamptz NOT NULL,
 start_at timestamptz NOT NULL,
 snapshot_hash text NOT NULL,
 evidence_published_at timestamptz NOT NULL,
 evidence_verified_at timestamptz NOT NULL,
 evidence_ingested_at timestamptz NOT NULL,
 payload jsonb NOT NULL,
 UNIQUE(game_id,cutoff_at,snapshot_hash),
 CHECK(cutoff_at < start_at AND generated_at < start_at),
 CHECK(evidence_published_at <= cutoff_at),
 CHECK(evidence_verified_at <= cutoff_at),
 CHECK(evidence_ingested_at <= cutoff_at)
);
CREATE FUNCTION public.security36_prevent_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $immut$
BEGIN
 RAISE EXCEPTION 'SECURITY-36 immutable prediction';
END $immut$;
CREATE TRIGGER security36_original_immutable BEFORE UPDATE OR DELETE
ON public.security36_originals FOR EACH ROW EXECUTE FUNCTION public.security36_prevent_mutation();
CREATE TRIGGER security36_version_immutable BEFORE UPDATE OR DELETE
ON public.security36_versions FOR EACH ROW EXECUTE FUNCTION public.security36_prevent_mutation();
REVOKE ALL ON public.security36_originals,public.security36_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.security36_versions TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.security36_versions_id_seq TO service_role;
INSERT INTO public.security36_originals VALUES (36,'{"frozen":true}');
INSERT INTO public.security36_versions
 (game_id,cutoff_at,generated_at,start_at,snapshot_hash,evidence_published_at,evidence_verified_at,evidence_ingested_at,payload)
VALUES (36,'2026-11-16 19:00+00','2026-11-16 19:01+00','2026-11-16 20:00+00',
 'hash-a','2026-11-16 18:50+00','2026-11-16 18:51+00','2026-11-16 18:52+00','{"goalie":"A"}');
INSERT INTO public.security36_versions
 (game_id,cutoff_at,generated_at,start_at,snapshot_hash,evidence_published_at,evidence_verified_at,evidence_ingested_at,payload)
VALUES (36,'2026-11-16 19:00+00','2026-11-16 19:01+00','2026-11-16 20:00+00',
 'hash-a','2026-11-16 18:50+00','2026-11-16 18:51+00','2026-11-16 18:52+00','{"goalie":"A"}')
ON CONFLICT (game_id,cutoff_at,snapshot_hash) DO NOTHING;
DO $security36$
DECLARE original_count int; version_count int;
BEGIN
 SELECT count(*) INTO original_count FROM public.security36_originals WHERE game_id=36 AND original_payload='{"frozen":true}'::jsonb;
 SELECT count(*) INTO version_count FROM public.security36_versions WHERE game_id=36;
 IF original_count<>1 OR version_count<>1 THEN RAISE EXCEPTION 'original changed or idempotency failed'; END IF;
 IF has_table_privilege('anon','public.security36_versions','SELECT')
 OR has_table_privilege('authenticated','public.security36_versions','INSERT')
 OR NOT has_table_privilege('service_role','public.security36_versions','INSERT')
 THEN RAISE EXCEPTION 'role isolation failed'; END IF;
END $security36$;
-- Expected failures are caught within the same transaction by nested exception blocks.
DO $security36$
BEGIN
 BEGIN
  INSERT INTO public.security36_versions
   (game_id,cutoff_at,generated_at,start_at,snapshot_hash,evidence_published_at,evidence_verified_at,evidence_ingested_at,payload)
  VALUES (36,'2026-11-16 19:00+00','2026-11-16 19:01+00','2026-11-16 20:00+00',
   'late','2026-11-16 19:02+00','2026-11-16 18:51+00','2026-11-16 18:52+00','{}');
  RAISE EXCEPTION 'late evidence accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  UPDATE public.security36_originals SET original_payload='{}' WHERE game_id=36;
  RAISE EXCEPTION 'original update accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'SECURITY-36 immutable prediction' THEN RAISE; END IF;
 END;
 BEGIN
  DELETE FROM public.security36_versions WHERE game_id=36;
  RAISE EXCEPTION 'version delete accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'SECURITY-36 immutable prediction' THEN RAISE; END IF;
 END;
END $security36$;
-- A distinct, valid cutoff is append-only.
INSERT INTO public.security36_versions
 (game_id,cutoff_at,generated_at,start_at,snapshot_hash,evidence_published_at,evidence_verified_at,evidence_ingested_at,payload)
VALUES (36,'2026-11-16 19:10+00','2026-11-16 19:11+00','2026-11-16 20:00+00',
 'hash-b','2026-11-16 19:05+00','2026-11-16 19:06+00','2026-11-16 19:07+00','{"goalie":"A"}');
DO $security36$
BEGIN
 IF (SELECT count(*) FROM public.security36_versions WHERE game_id=36) <> 2
 THEN RAISE EXCEPTION 'append-only versions missing'; END IF;
END $security36$;
ROLLBACK;
SELECT CASE WHEN to_regclass('public.security36_versions') IS NULL
 AND to_regclass('public.security36_originals') IS NULL
 THEN 'PASS SECURITY-36 PostgreSQL append-only and permissions' ELSE 'FAIL SECURITY-36 cleanup' END;
