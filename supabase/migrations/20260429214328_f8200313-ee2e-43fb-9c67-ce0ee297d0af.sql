ALTER TABLE public.opme_requests 
RENAME COLUMN attending_doctor_name TO responsible_name;

ALTER TABLE public.opme_requests 
RENAME COLUMN attending_doctor_crm TO responsible_register;