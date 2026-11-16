#!/usr/bin/env bash
# SECURITY-44: local-only PostgreSQL conflicting payload and lock timeout tests.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
cleanup() { db -qAtc "DROP TABLE IF EXISTS public.security44_versions" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
db -qAtc "CREATE TABLE public.security44_versions(
 game_id bigint NOT NULL, cutoff_at timestamptz NOT NULL,
 snapshot_hash text NOT NULL, payload jsonb NOT NULL,
 PRIMARY KEY(game_id,cutoff_at)
)" >/dev/null
base="INSERT INTO public.security44_versions VALUES (44,'2026-11-16 19:00+00','hash-a','{\"goalie\":\"A\"}')"
db -qAtc "$base" >/dev/null
# A same-key but different hash/payload must be an error, not silently ignored.
conflict="INSERT INTO public.security44_versions VALUES (44,'2026-11-16 19:00+00','hash-b','{\"goalie\":\"B\"}') ON CONFLICT (game_id,cutoff_at) DO UPDATE SET snapshot_hash=EXCLUDED.snapshot_hash, payload=EXCLUDED.payload WHERE public.security44_versions.snapshot_hash=EXCLUDED.snapshot_hash AND public.security44_versions.payload=EXCLUDED.payload"
# WHERE false produces no change, but a caller must detect the zero affected rows.
rows="$(db -Atqc "WITH attempt AS ($conflict RETURNING 1) SELECT count(*) FROM attempt")"
[[ "$rows" == "0" ]] || { echo 'FAIL SECURITY-44 conflict was accepted'; exit 1; }
unchanged="$(db -Atqc "SELECT count(*) FROM public.security44_versions WHERE snapshot_hash='hash-a' AND payload='{\"goalie\":\"A\"}'::jsonb")"
[[ "$unchanged" == "1" ]] || { echo 'FAIL SECURITY-44 original was overwritten'; exit 1; }
# Concurrent holder of row lock. Wait until holder is sleeping before retrying.
(
 db -qAtc "BEGIN; UPDATE public.security44_versions SET payload=payload WHERE game_id=44; SELECT pg_sleep(8); ROLLBACK;" >/dev/null
) &
holder=$!
ready=0
for n in $(seq 1 80); do
 count="$(db -Atqc "SELECT count(*) FROM pg_stat_activity WHERE datname='security09' AND state='active' AND wait_event='PgSleep' AND query LIKE '%security44_versions%'")"
 if [[ "$count" -ge 1 ]]; then ready=1; break; fi
 sleep 0.1
done
if [[ "$ready" != "1" ]]; then wait "$holder" || true; echo 'FAIL SECURITY-44 lock holder not ready'; exit 1; fi
# Bounded retry: every attempt must fail closed under a real lock timeout.
for n in 1 2 3; do
 if db -qAtc "SET lock_timeout='200ms'; UPDATE public.security44_versions SET payload='{\"goalie\":\"B\"}' WHERE game_id=44;" >/dev/null 2>&1; then
   echo "FAIL SECURITY-44 attempt $n bypassed lock timeout"
   wait "$holder" || true
   exit 1
 fi
done
wait "$holder"
unchanged="$(db -Atqc "SELECT count(*) FROM public.security44_versions WHERE snapshot_hash='hash-a' AND payload='{\"goalie\":\"A\"}'::jsonb")"
[[ "$unchanged" == "1" ]] || { echo 'FAIL SECURITY-44 timeout mutated row'; exit 1; }
echo 'PASS SECURITY-44 conflicting payload, lock timeout and bounded retry'
