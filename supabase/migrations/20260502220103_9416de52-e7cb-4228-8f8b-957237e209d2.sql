CREATE OR REPLACE FUNCTION public.log_opme_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name TEXT;
BEGIN
  SELECT name INTO user_name FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.opme_history (opme_request_id, action, new_value, changed_by, changed_by_name)
    VALUES (NEW.id, 'created', NEW.status::text, COALESCE(auth.uid(), NEW.created_by), user_name);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'status_changed', 'status', OLD.status::text, NEW.status::text, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.patient_name IS DISTINCT FROM OLD.patient_name THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'patient_name', OLD.patient_name, NEW.patient_name, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.procedure_name IS DISTINCT FROM OLD.procedure_name THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'procedure_name', OLD.procedure_name, NEW.procedure_name, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.auditor_pre_opinion IS DISTINCT FROM OLD.auditor_pre_opinion THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'auditor_pre_opinion', OLD.auditor_pre_opinion, NEW.auditor_pre_opinion, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.auditor_post_final_opinion IS DISTINCT FROM OLD.auditor_post_final_opinion THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'auditor_post_final_opinion', OLD.auditor_post_final_opinion, NEW.auditor_post_final_opinion, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.facility_unit IS DISTINCT FROM OLD.facility_unit THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'facility_unit', OLD.facility_unit, NEW.facility_unit, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.cme_processing_date IS DISTINCT FROM OLD.cme_processing_date THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'cme_processing_date', OLD.cme_processing_date::text, NEW.cme_processing_date::text, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.cme_responsible IS DISTINCT FROM OLD.cme_responsible THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'cme_responsible', OLD.cme_responsible, NEW.cme_responsible, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.surgery_dispatch_date IS DISTINCT FROM OLD.surgery_dispatch_date THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'surgery_dispatch_date', OLD.surgery_dispatch_date::text, NEW.surgery_dispatch_date::text, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    IF NEW.surgery_dispatch_responsible IS DISTINCT FROM OLD.surgery_dispatch_responsible THEN
      INSERT INTO public.opme_history (opme_request_id, action, field_changed, old_value, new_value, changed_by, changed_by_name)
      VALUES (NEW.id, 'field_changed', 'surgery_dispatch_responsible', OLD.surgery_dispatch_responsible, NEW.surgery_dispatch_responsible, COALESCE(auth.uid(), NEW.created_by), user_name);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;