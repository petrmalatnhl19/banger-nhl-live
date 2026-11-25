-- Execute under the migration role. Public summaries retain coverage while
-- the raw evidence and frozen input details remain inaccessible.
begin;
select set_config('test.prediction_rows',(select count(*)::text from public.core43_shadow_predictions_v1),true),
       set_config('test.preview_rows',(select count(*)::text from public.core43_shadow_preview_v1),true);
set local role anon;
do $test$
begin
  if (select count(*) from public.core43_shadow_predictions_v1)<>current_setting('test.prediction_rows')::bigint
    or (select count(*) from public.core43_shadow_preview_v1)<>current_setting('test.preview_rows')::bigint
    or has_table_privilege(current_user,'public.core43_verified_starter_evidence','select')
    or has_table_privilege(current_user,'public.core43_verified_shadow_inputs','select')
    then raise exception 'Public summary coverage or internal access changed';
  end if;
end $test$;
rollback;
