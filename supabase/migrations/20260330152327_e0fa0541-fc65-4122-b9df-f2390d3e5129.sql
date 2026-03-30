
ALTER TABLE public.profiles ADD COLUMN supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_supervisor_id ON public.profiles(supervisor_id);
