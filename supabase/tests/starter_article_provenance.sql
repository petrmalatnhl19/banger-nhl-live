-- Read-only regression assertions for the retained production audit sample.
do $test$
begin
  if exists(select from public.nhl_core43_starter_evidence where id=1590740) then
    if not exists(select from public.core43_verified_starter_evidence
      where id=1590740 and source_published_at='2026-11-24 18:11:36Z') then
      raise exception 'Tarasov article lost';
    end if;
    if exists(select from public.core43_verified_starter_evidence where id in (1591790,1656892)) then
      raise exception 'Snapshot promoted to article';
    end if;
  end if;
  if exists(select from public.core43_verified_starter_evidence where article_text is null
      or source_published_at>verified_at) then raise exception 'Missing proof'; end if;
  if exists(select from public.core43_verified_shadow_inputs s where s.readiness='ready' and
    not exists(select from public.core43_verified_starter_evidence e where
      (s.game_id,s.team_code,s.goalie_id,s.starter_published_at,s.starter_verified_at)=
      (e.game_id,e.team_code,e.goalie_id,e.source_published_at,e.verified_at)
      and e.verified_at<=s.prediction_at)) then raise exception 'Unverified frozen input'; end if;
end $test$;
