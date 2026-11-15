-- Review-only migration. Keep outside automatic migration paths.
-- A failed preflight rolls back the entire transaction, including role creation.
BEGIN;
SET LOCAL search_path = pg_catalog;

CREATE ROLE core43_cal04_reader
    NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
    NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO core43_cal04_reader;

DO $reader$
DECLARE
    reader CONSTANT name := 'core43_cal04_reader';
    source record;
    unexpected text;
BEGIN
    -- PUBLIC grants still apply to NOINHERIT roles. Check effective permissions
    -- before granting any table access or allowing PostgREST to assume the role.
    SELECT format('%I.%I', n.nspname, p.proname) INTO unexpected
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
      AND has_schema_privilege(reader, n.oid, 'USAGE')
      AND has_function_privilege(reader, p.oid, 'EXECUTE')
    ORDER BY (p.prosecdef OR p.provolatile = 'v') DESC, n.nspname, p.proname
    LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Reader has unexpected routine access: %', unexpected;
    END IF;

    SELECT format('%I.%I', n.nspname, c.relname) INTO unexpected
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
      AND has_schema_privilege(reader, n.oid, 'USAGE')
      AND CASE
          WHEN c.relkind = 'S' THEN has_sequence_privilege(reader, c.oid, 'USAGE, SELECT, UPDATE')
          WHEN c.relkind IN ('r', 'p', 'v', 'm', 'f') THEN
              has_table_privilege(reader, c.oid, 'TRUNCATE, TRIGGER, MAINTAIN')
              OR has_any_column_privilege(reader, c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
              OR has_table_privilege(reader, c.oid, 'DELETE')
          ELSE false
      END
    ORDER BY n.nspname, c.relname
    LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Reader has unexpected relation access: %', unexpected;
    END IF;

    SELECT n.nspname INTO unexpected
    FROM pg_namespace AS n
    WHERE has_schema_privilege(reader, n.oid, 'CREATE')
    ORDER BY n.nspname
    LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Reader has unexpected schema CREATE access: %', unexpected;
    END IF;

    FOR source IN
        SELECT * FROM (VALUES
            ('nhl_core43_schedule_snapshots', 'game_id, away_team, home_team, kickoff_at, fetched_at'),
            ('nhl_prediction_archive', 'game_id, away_team, home_team, core42_predicted_at, core42_away, core42_home'),
            ('nhl_core43_rotowire_observations', 'game_id, team_code, goalie_name, observed_status, observed_at, source_snapshot_at'),
            ('nhl_core43_goalie_identity_map', 'goalie_id, goalie_name, team_code, observed_at'),
            ('nhl_core43_goalie_snapshots', 'goalie_id, team_code, situation, fetched_at, created_at, source_sha256, x_goals_against, goals_against, shots_against')
        ) AS sources(table_name, columns)
    LOOP
        IF NOT EXISTS (
            SELECT FROM pg_class AS c
            JOIN pg_namespace AS n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = source.table_name
              AND c.relkind IN ('r', 'p') AND c.relrowsecurity
        ) THEN
            RAISE EXCEPTION 'Reader source is missing or lacks RLS: public.%', source.table_name;
        END IF;

        EXECUTE format('GRANT SELECT (%s) ON TABLE public.%I TO %I', source.columns, source.table_name, reader);
        EXECUTE format('CREATE POLICY core43_cal04_reader_select ON public.%I FOR SELECT TO %I USING (true)',
            source.table_name, reader);
    END LOOP;
END;
$reader$;

-- PostgREST needs SET ROLE, but does not need to inherit or delegate these grants.
GRANT core43_cal04_reader TO authenticator WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
COMMIT;
