ALTER TABLE public.opme_requests 
ADD COLUMN IF NOT EXISTS preop_exams_details JSONB DEFAULT '[]'::jsonb;