-- SECURITY-43: adversarial timestamp/provenance validation in synthetic PostgreSQL.
-- Every object and fixture is transactional; no production DB connection.
BEGIN;
CREATE TABLE public.security43_evidence (
 evidence_id text PRIMARY KEY,
 game_id bigint NOT NULL,
 goalie_id text NOT NULL,
 source_name text NOT NULL CHECK (source_name IN ('RotoWire','DailyFaceoff')),
 source_published_at timestamptz NOT NULL,
 verified_at timestamptz NOT NULL,
 ingested_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL,
 CHECK (source_published_at <= received_at),
 CHECK (verified_at <= received_at),
 CHECK (ingested_at <= received_at)
);
CREATE TABLE public.security43_versions (
 game_id bigint NOT NULL,
 evidence_id text NOT NULL REFERENCES public.security43_evidence(evidence_id),
 cutoff_at timestamptz NOT NULL,
 generated_at timestamptz NOT NULL,
 actual_start_at timestamptz NOT NULL,
 game_status text NOT NULL,
 snapshot_hash text NOT NULL,
 PRIMARY KEY(game_id,cutoff_at,snapshot_hash),
 CHECK (game_status = 'scheduled'),
 CHECK (cutoff_at <= generated_at AND generated_at < actual_start_at)
);
CREATE FUNCTION public.security43_guard_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $body$
DECLARE e public.security43_evidence%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.security43_evidence WHERE evidence_id=NEW.evidence_id;
 IF NOT FOUND OR e.game_id <> NEW.game_id
    OR e.source_published_at > NEW.cutoff_at
    OR e.verified_at > NEW.cutoff_at
    OR e.ingested_at > NEW.cutoff_at
    OR e.received_at > NEW.cutoff_at
 THEN RAISE EXCEPTION 'SECURITY43_REJECT_EVIDENCE'; END IF;
 RETURN NEW;
END $body$;
CREATE TRIGGER security43_guard BEFORE INSERT ON public.security43_versions
FOR EACH ROW EXECUTE FUNCTION public.security43_guard_evidence();
CREATE FUNCTION public.security43_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $body$
BEGIN RAISE EXCEPTION 'SECURITY43_IMMUTABLE'; END $body$;
CREATE TRIGGER security43_evidence_immutable BEFORE UPDATE OR DELETE ON public.security43_evidence
FOR EACH ROW EXECUTE FUNCTION public.security43_immutable();
CREATE TRIGGER security43_versions_immutable BEFORE UPDATE OR DELETE ON public.security43_versions
FOR EACH ROW EXECUTE FUNCTION public.security43_immutable();

INSERT INTO public.security43_evidence VALUES
 ('good',43,'G1','RotoWire','2026-11-16 18:00+00','2026-11-16 18:01+00','2026-11-16 18:02+00','2026-11-16 18:03+00'),
 ('latepub',43,'G1','RotoWire','2026-11-16 19:01+00','2026-11-16 18:01+00','2026-11-16 18:02+00','2026-11-16 19:02+00'),
 ('lateverify',43,'G1','RotoWire','2026-11-16 18:00+00','2026-11-16 19:01+00','2026-11-16 18:02+00','2026-11-16 19:02+00'),
 ('lateingest',43,'G1','RotoWire','2026-11-16 18:00+00','2026-11-16 18:01+00','2026-11-16 19:01+00','2026-11-16 19:02+00'),
 ('latereceive',43,'G1','RotoWire','2026-11-16 18:00+00','2026-11-16 18:01+00','2026-11-16 18:02+00','2026-11-16 19:01+00'),
 ('wronggame',44,'G1','RotoWire','2026-11-16 18:00+00','2026-11-16 18:01+00','2026-11-16 18:02+00','2026-11-16 18:03+00');

INSERT INTO public.security43_versions VALUES
 (43,'good','2026-11-16 19:00+00','2026-11-16 19:01+00','2026-11-16 20:00+00','scheduled','hash-good');

DO $test$
DECLARE case_id text;
BEGIN
 FOREACH case_id IN ARRAY ARRAY['latepub','lateverify','lateingest','latereceive','wronggame'] LOOP
  BEGIN
   INSERT INTO public.security43_versions VALUES
    (43,case_id,'2026-11-16 19:00+00','2026-11-16 19:01+00','2026-11-16 20:00+00','scheduled',case_id);
   RAISE EXCEPTION 'SECURITY43_TEST_ACCEPTED_INVALID_%',case_id;
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'SECURITY43_REJECT_EVIDENCE' THEN RAISE; END IF;
  END;
 END LOOP;
 BEGIN
  INSERT INTO public.security43_versions VALUES
   (43,'good','2026-11-16 20:00+00','2026-11-16 20:01+00','2026-11-16 20:00+00','scheduled','late-start');
  RAISE EXCEPTION 'SECURITY43_TEST_ACCEPTED_AFTER_START';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO public.security43_versions VALUES
   (43,'good','2026-11-16 19:00+00','2026-11-16 19:01+00','2026-11-16 20:00+00','live','live-status');
  RAISE EXCEPTION 'SECURITY43_TEST_ACCEPTED_LIVE';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  UPDATE public.security43_evidence SET source_published_at='2026-11-16 17:00+00' WHERE evidence_id='latepub';
  RAISE EXCEPTION 'SECURITY43_TEST_ALLOWED_BACKDATE';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'SECURITY43_IMMUTABLE' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.security43_versions)<>1
 THEN RAISE EXCEPTION 'SECURITY43_UNEXPECTED_VERSION_COUNT'; END IF;
END $test$;
ROLLBACK;
SELECT CASE WHEN to_regclass('public.security43_evidence') IS NULL
 AND to_regclass('public.security43_versions') IS NULL
 THEN 'PASS SECURITY-43 adversarial provenance and time cutoff'
 ELSE 'FAIL SECURITY-43 cleanup' END;
