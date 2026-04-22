-- 1) Add responder tracking columns to quotation_invites
ALTER TABLE public.quotation_invites
  ADD COLUMN IF NOT EXISTS responder_name text,
  ADD COLUMN IF NOT EXISTS responder_email text,
  ADD COLUMN IF NOT EXISTS responder_phone text,
  ADD COLUMN IF NOT EXISTS responder_cpf text;

-- 2) Update submit_invite_response to capture responder identity
CREATE OR REPLACE FUNCTION public.submit_invite_response(
  _token uuid,
  _prazo_entrega text,
  _condicao_pagamento text,
  _observacoes text,
  _responses jsonb,
  _ip text DEFAULT NULL,
  _responder_name text DEFAULT NULL,
  _responder_email text DEFAULT NULL,
  _responder_phone text DEFAULT NULL,
  _responder_cpf text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.quotation_invites%ROWTYPE;
  v_quotation_id uuid;
  v_supplier_row_id uuid;
  v_supplier_id uuid;
  v_resp jsonb;
  v_total numeric := 0;
  v_slot text;
  v_existing_count int;
  v_qty numeric;
  v_valor numeric;
  v_disponivel boolean;
  v_desc text;
  v_um text;
BEGIN
  SELECT * INTO v_invite FROM public.quotation_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'invite_not_found'); END IF;
  IF v_invite.expires_at < now() THEN RETURN jsonb_build_object('success', false, 'error', 'expired'); END IF;
  IF v_invite.submitted_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'already_submitted'); END IF;

  -- Validate required responder identity
  IF COALESCE(trim(_responder_name), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_responder_name');
  END IF;
  IF COALESCE(trim(_responder_email), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_responder_email');
  END IF;
  IF COALESCE(trim(_responder_phone), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_responder_phone');
  END IF;

  UPDATE public.quotation_invites
     SET status = 'respondido', submitted_at = now(),
         prazo_entrega = _prazo_entrega, condicao_pagamento = _condicao_pagamento, observacoes = _observacoes,
         submission_ip = _ip,
         responder_name = _responder_name,
         responder_email = _responder_email,
         responder_phone = _responder_phone,
         responder_cpf = NULLIF(trim(_responder_cpf), '')
   WHERE id = v_invite.id;

  DELETE FROM public.quotation_invite_responses WHERE invite_id = v_invite.id;

  v_supplier_id := public.upsert_supplier_from_cnpj(v_invite.fornecedor_nome, v_invite.fornecedor_cnpj);

  FOR v_resp IN SELECT * FROM jsonb_array_elements(_responses)
  LOOP
    v_valor := COALESCE((v_resp->>'valor_unitario')::numeric, 0);
    v_disponivel := COALESCE((v_resp->>'disponivel')::boolean, true);
    INSERT INTO public.quotation_invite_responses (invite_id, requisition_item_id, valor_unitario, disponivel, observacao)
    VALUES (v_invite.id, (v_resp->>'requisition_item_id')::uuid, v_valor, v_disponivel, v_resp->>'observacao');
    SELECT quantidade INTO v_qty FROM public.purchase_requisition_items WHERE id = (v_resp->>'requisition_item_id')::uuid;
    IF v_disponivel THEN v_total := v_total + (v_valor * COALESCE(v_qty, 0)); END IF;
  END LOOP;

  SELECT id INTO v_quotation_id FROM public.purchase_quotations WHERE requisition_id = v_invite.requisition_id LIMIT 1;
  IF v_quotation_id IS NULL THEN
    INSERT INTO public.purchase_quotations (requisition_id, facility_unit, numero, created_by, status)
    SELECT r.id, r.facility_unit, 'COT-' || to_char(now(),'YYYYMMDDHH24MISS'), v_invite.created_by, 'em_andamento'::purchase_quotation_status
      FROM public.purchase_requisitions r WHERE r.id = v_invite.requisition_id
    RETURNING id INTO v_quotation_id;
  END IF;

  SELECT count(*) INTO v_existing_count FROM public.purchase_quotation_suppliers WHERE quotation_id = v_quotation_id;
  IF v_existing_count = 0 THEN v_slot := '1';
  ELSIF v_existing_count = 1 THEN v_slot := '2';
  ELSIF v_existing_count = 2 THEN v_slot := '3';
  ELSE v_slot := 'extra'; END IF;

  DELETE FROM public.purchase_quotation_suppliers
   WHERE quotation_id = v_quotation_id
     AND fornecedor_nome = v_invite.fornecedor_nome
     AND COALESCE(fornecedor_cnpj,'') = COALESCE(v_invite.fornecedor_cnpj,'');

  INSERT INTO public.purchase_quotation_suppliers (quotation_id, slot, fornecedor_nome, fornecedor_cnpj, prazo_entrega, condicao_pagamento, fonte, total, submission_ip)
  VALUES (v_quotation_id, v_slot, v_invite.fornecedor_nome, v_invite.fornecedor_cnpj, _prazo_entrega, _condicao_pagamento, 'invite_link', v_total, _ip)
  RETURNING id INTO v_supplier_row_id;

  FOR v_resp IN SELECT * FROM jsonb_array_elements(_responses)
  LOOP
    v_valor := COALESCE((v_resp->>'valor_unitario')::numeric, 0);
    v_disponivel := COALESCE((v_resp->>'disponivel')::boolean, true);
    SELECT quantidade, descricao, unidade_medida INTO v_qty, v_desc, v_um
      FROM public.purchase_requisition_items WHERE id = (v_resp->>'requisition_item_id')::uuid;

    INSERT INTO public.purchase_quotation_prices (quotation_id, requisition_item_id, supplier_id, valor_unitario, valor_total, is_winner)
    VALUES (
      v_quotation_id, (v_resp->>'requisition_item_id')::uuid, v_supplier_row_id,
      CASE WHEN v_disponivel THEN v_valor ELSE 0 END,
      CASE WHEN v_disponivel THEN v_valor * COALESCE(v_qty,0) ELSE 0 END,
      false
    );

    IF v_disponivel AND v_valor > 0 AND v_supplier_id IS NOT NULL THEN
      INSERT INTO public.price_history (
        descricao_produto, valor_unitario, unidade_medida,
        fornecedor_nome, fornecedor_cnpj, supplier_id,
        data_referencia, fonte, quotation_id, created_by
      ) VALUES (
        v_desc, v_valor, COALESCE(v_um,'UN'),
        v_invite.fornecedor_nome, v_invite.fornecedor_cnpj, v_supplier_id,
        CURRENT_DATE, 'cotacao_link', v_quotation_id, v_invite.created_by
      );
    END IF;
  END LOOP;

  INSERT INTO public.purchase_audit_log (entity_type, entity_id, action, changed_by, changed_by_name, motivo)
  VALUES ('quotation_invite', v_invite.id, 'submitted', v_invite.created_by,
          COALESCE(_responder_name, v_invite.fornecedor_nome),
          'Resposta recebida via link público — Respondente: ' || COALESCE(_responder_name,'?') ||
          ' <' || COALESCE(_responder_email,'?') || '> tel ' || COALESCE(_responder_phone,'?') ||
          CASE WHEN COALESCE(trim(_responder_cpf),'') <> '' THEN ' CPF ' || _responder_cpf ELSE '' END ||
          ' — IP ' || COALESCE(_ip, 'não capturado'));

  RETURN jsonb_build_object('success', true, 'quotation_id', v_quotation_id);
END;
$function$;