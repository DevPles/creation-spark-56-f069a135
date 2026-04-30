ALTER TABLE public.opme_requests 
ADD COLUMN IF NOT EXISTS auditor_post_justification_requested BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auditor_post_justification_reason TEXT;