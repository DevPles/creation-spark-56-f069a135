
-- Remove the auto-admin trigger since admin is created manually
DROP TRIGGER IF EXISTS on_first_admin_assignment ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_first_admin();
