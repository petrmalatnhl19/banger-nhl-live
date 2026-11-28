-- Restore verified baseline: reloptions NULL. Recheck before use.
ALTER VIEW public.nhl_core42_status RESET (security_invoker);
ALTER VIEW public.nhl_core_model_accuracy RESET (security_invoker);
ALTER VIEW public.nhl_core_model_head_to_head RESET (security_invoker);
ALTER VIEW public.nhl_core_model_trend RESET (security_invoker);
