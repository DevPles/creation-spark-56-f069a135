CREATE OR REPLACE FUNCTION public.get_order_for_approval(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appr public.purchase_order_approvals%ROWTYPE;
  v_order public.purchase_orders%ROWTYPE;
  v_items jsonb;
  v_req_numero text;
  v_contract public.contracts%ROWTYPE;
  v_rubrica jsonb;
  v_rubrica_percent numeric := 0;
  v_rubrica_budget numeric := 0;
  v_rubrica_spent numeric := 0;
BEGIN
  SELECT * INTO v_appr FROM public.purchase_order_approvals WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF v_appr.expires_at < now() THEN RETURN jsonb_build_object('error','expired'); END IF;
  SELECT * INTO v_order FROM public.purchase_orders WHERE id = v_appr.purchase_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','order_missing'); END IF;
  SELECT numero INTO v_req_numero FROM public.purchase_requisitions WHERE id = v_order.requisition_id;

  -- Look up rubrica budget from contract.rubricas jsonb
  IF v_order.contract_id IS NOT NULL THEN
    SELECT * INTO v_contract FROM public.contracts WHERE id = v_order.contract_id;
    IF FOUND AND v_order.rubrica_id IS NOT NULL THEN
      SELECT r INTO v_rubrica
        FROM jsonb_array_elements(COALESCE(v_contract.rubricas,'[]'::jsonb)) r
       WHERE r->>'id' = v_order.rubrica_id
       LIMIT 1;
      IF v_rubrica IS NOT NULL THEN
        v_rubrica_percent := COALESCE((v_rubrica->>'percent')::numeric, 0);
        v_rubrica_budget := COALESCE(v_contract.value, 0) * v_rubrica_percent / 100.0;
      END IF;
      SELECT COALESCE(SUM(valor_total), 0)
        INTO v_rubrica_spent
        FROM public.purchase_orders
       WHERE contract_id = v_order.contract_id
         AND rubrica_id = v_order.rubrica_id
         AND id <> v_order.id
         AND status IN ('autorizada','enviada','recebida');
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'item_num', item_num,'descricao', descricao,'quantidade', quantidade,
    'unidade_medida', unidade_medida,'valor_unitario', valor_unitario,'valor_total', valor_total
  ) ORDER BY item_num), '[]'::jsonb)
  INTO v_items FROM public.purchase_order_items WHERE purchase_order_id = v_order.id;

  RETURN jsonb_build_object(
    'approval', jsonb_build_object(
      'id', v_appr.id,'expires_at', v_appr.expires_at,'signed_at', v_appr.signed_at,
      'decision', v_appr.decision,'approver_name', v_appr.approver_name,
      'approver_cargo', v_appr.approver_cargo,'motivo_recusa', v_appr.motivo_recusa
    ),
    'order', jsonb_build_object(
      'id', v_order.id,'numero', v_order.numero,'requisicao_numero', v_req_numero,
      'facility_unit', v_order.facility_unit,'fornecedor_nome', v_order.fornecedor_nome,
      'fornecedor_cnpj', v_order.fornecedor_cnpj,'endereco_entrega', v_order.endereco_entrega,
      'prazo_entrega', v_order.prazo_entrega,'rubrica_name', v_order.rubrica_name,
      'observacoes', v_order.observacoes,'valor_total', v_order.valor_total,'status', v_order.status,
      'contract_name', COALESCE(v_contract.name, NULL),
      'contract_value', COALESCE(v_contract.value, NULL),
      'rubrica_percent', v_rubrica_percent,
      'rubrica_budget', v_rubrica_budget,
      'rubrica_spent', v_rubrica_spent,
      'rubrica_remaining', GREATEST(v_rubrica_budget - v_rubrica_spent - COALESCE(v_order.valor_total,0), 0)
    ),
    'items', v_items
  );
END;
$function$;