-- Public summary views execute as their owner. Keep their original row visibility.
-- Both internal views have an explicit service-only SELECT grant.
alter view public.core43_verified_shadow_inputs set (security_invoker=false);
alter view public.core43_verified_starter_evidence set (security_invoker=false);
do $acl$
begin
  if exists (select from (values ('anon'),('authenticated')) as roles(name)
    cross join (values ('public.core43_verified_shadow_inputs'),('public.core43_verified_starter_evidence')) as views(name)
    where has_table_privilege(roles.name,views.name,'select')) then
    raise exception 'Internal provenance views require service-only access';
  end if;
end $acl$;
