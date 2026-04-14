-- Drop the existing unique constraint that doesn't include version
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_contract_id_facility_unit_reference_month_reference_key;

-- Recreate with version included
ALTER TABLE public.reports ADD CONSTRAINT reports_contract_id_facility_unit_reference_month_version_key 
  UNIQUE (contract_id, facility_unit, reference_month, reference_year, version);