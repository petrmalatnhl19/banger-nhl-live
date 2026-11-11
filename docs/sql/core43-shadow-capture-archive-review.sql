-- REVIEW-ONLY DDL: do not deploy before checking existing grants and DB migration history.
-- Dedicated experimental-only archive; never modify nhl_prediction_archive.
create table if not exists public.nhl_core43_shadow_capture_archive (
 game_id text not null,
 model_version text not null,
 predicted_at timestamptz not null,
 frozen_at timestamptz not null,
 kickoff_at timestamptz not null,
 capture_sha256 text not null check (capture_sha256 ~ '^[a-f0-9]{64}$'),
 source_archive_id text not null,
 payload jsonb not null,
 production boolean not null default false check (production = false),
 experimental boolean not null default true check (experimental = true),
 archived_at timestamptz not null default now(),
 primary key (game_id,model_version,predicted_at),
 constraint capture_before_kickoff check (predicted_at <= frozen_at and frozen_at < kickoff_at),
 constraint capture_archived_before_kickoff check (archived_at < kickoff_at),
 constraint capture_near_real_time check (archived_at >= frozen_at and archived_at <= frozen_at + interval '2 minutes')
);
alter table public.nhl_core43_shadow_capture_archive enable row level security;
revoke all on public.nhl_core43_shadow_capture_archive from public,anon,authenticated;
-- No policies: service_role can insert, regular browser roles cannot.
-- Additional defense: block all UPDATE/DELETE even from service_role via a trigger.
create or replace function public.core43_reject_shadow_archive_mutation() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin raise exception 'CORE 4.3 shadow capture archive is append-only'; end; $$;
revoke all on function public.core43_reject_shadow_archive_mutation() from public,anon,authenticated;
drop trigger if exists core43_shadow_capture_immutable on public.nhl_core43_shadow_capture_archive;
create trigger core43_shadow_capture_immutable before update or delete on public.nhl_core43_shadow_capture_archive
for each row execute function public.core43_reject_shadow_archive_mutation();
