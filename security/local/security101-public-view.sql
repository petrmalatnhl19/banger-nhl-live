-- SECURITY-101: disposable local PostgREST fixture ONLY; no production deployment.
-- The underlying source is in a schema that is NOT exposed by PostgREST.
CREATE SCHEMA security101_private;
CREATE TABLE security101_private.tv_source (
  game_id bigint PRIMARY KEY,
  core42_away numeric, core42_home numeric,
  core43_away numeric, core43_home numeric,
  core43_preview_away numeric, core43_preview_home numeric,
  away_gsax_per100 numeric, home_gsax_per100 numeric,
  internal_goalie_evidence text NOT NULL,
  internal_operator_notes text NOT NULL
);
INSERT INTO security101_private.tv_source VALUES
  (101,2,3,2.2,3.3,2.7,3.4,1.5,2.5,'private starter','never expose');
ALTER TABLE security101_private.tv_source ENABLE ROW LEVEL SECURITY;
CREATE POLICY security101_select ON security101_private.tv_source
  FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON SCHEMA security101_private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA security101_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA security101_private TO anon, authenticated;
GRANT SELECT ON security101_private.tv_source TO anon, authenticated;
CREATE VIEW public.security101_tv_public_v1 WITH (security_invoker = true) AS
SELECT game_id,core42_away,core42_home,core43_away,core43_home,
       core43_preview_away,core43_preview_home,
       away_gsax_per100,home_gsax_per100
FROM security101_private.tv_source;
REVOKE ALL ON public.security101_tv_public_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.security101_tv_public_v1 TO anon, authenticated;
