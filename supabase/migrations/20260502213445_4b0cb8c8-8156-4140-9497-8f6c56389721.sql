ALTER TABLE public.opme_requests
  ADD COLUMN IF NOT EXISTS patient_blood_type text,
  ADD COLUMN IF NOT EXISTS patient_allergies text,
  ADD COLUMN IF NOT EXISTS patient_diseases jsonb NOT NULL DEFAULT '[]'::jsonb;