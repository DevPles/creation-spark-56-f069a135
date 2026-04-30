-- Create audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    request_id UUID REFERENCES public.opme_requests(id) NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX idx_audit_logs_request_id ON public.audit_logs(request_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);