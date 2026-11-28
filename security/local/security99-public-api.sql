-- SECURITY-99: disposable fixture only. Never run on production.
CREATE TABLE public.security99_tv_public_v1 (
  game_id bigint PRIMARY KEY,
  core42_away numeric, core42_home numeric,
  core43_away numeric, core43_home numeric,
  core43_preview_away numeric, core43_preview_home numeric,
  away_gsax_per100 numeric, home_gsax_per100 numeric
);
ALTER TABLE public.security99_tv_public_v1 ENABLE ROW LEVEL SECURITY;
CREATE POLICY security99_public_read ON public.security99_tv_public_v1
  FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON public.security99_tv_public_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.security99_tv_public_v1 TO anon, authenticated;
INSERT INTO public.security99_tv_public_v1 VALUES (1,2,3,2.2,3.3,2.7,3.4,1.5,2.5);
