-- Proposal only; never automatically apply to production.
ALTER VIEW public.nhl_core42_status SET (security_invoker = true);
ALTER VIEW public.nhl_core_model_accuracy SET (security_invoker = true);
ALTER VIEW public.nhl_core_model_head_to_head SET (security_invoker = true);
ALTER VIEW public.nhl_core_model_trend SET (security_invoker = true);
