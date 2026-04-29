ALTER TABLE public.opme_requests 
ADD COLUMN IF NOT EXISTS attending_doctor_name TEXT,
ADD COLUMN IF NOT EXISTS attending_doctor_crm TEXT;