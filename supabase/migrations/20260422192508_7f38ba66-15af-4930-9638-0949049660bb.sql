-- 1. Add image_url to product_catalog
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Add product_id to purchase_requisition_items (link to catalog)
ALTER TABLE public.purchase_requisition_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.product_catalog(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pri_product_id ON public.purchase_requisition_items(product_id);

-- 3. Create public storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS policies for product-images bucket
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated can upload product images" ON storage.objects;
CREATE POLICY "Authenticated can upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated can update product images" ON storage.objects;
CREATE POLICY "Authenticated can update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated can delete product images" ON storage.objects;
CREATE POLICY "Authenticated can delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');

-- 5. Update get_invite_by_token to include image_url
CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.quotation_invites%ROWTYPE;
  v_requisition public.purchase_requisitions%ROWTYPE;
  v_items jsonb;
  v_responses jsonb;
BEGIN
  SELECT * INTO v_invite FROM public.quotation_invites WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invite_not_found');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired', 'fornecedor_nome', v_invite.fornecedor_nome);
  END IF;

  SELECT * INTO v_requisition FROM public.purchase_requisitions WHERE id = v_invite.requisition_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'item_num', i.item_num,
    'descricao', i.descricao,
    'quantidade', i.quantidade,
    'unidade_medida', i.unidade_medida,
    'observacao', i.observacao,
    'image_url', pc.image_url
  ) ORDER BY i.item_num), '[]'::jsonb)
  INTO v_items
  FROM public.purchase_requisition_items i
  LEFT JOIN public.product_catalog pc ON pc.id = i.product_id
  WHERE i.requisition_id = v_invite.requisition_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'requisition_item_id', r.requisition_item_id,
    'valor_unitario', r.valor_unitario,
    'disponivel', r.disponivel,
    'observacao', r.observacao
  )), '[]'::jsonb)
  INTO v_responses
  FROM public.quotation_invite_responses r
  WHERE r.invite_id = v_invite.id;

  RETURN jsonb_build_object(
    'invite', jsonb_build_object(
      'id', v_invite.id,
      'fornecedor_nome', v_invite.fornecedor_nome,
      'fornecedor_cnpj', v_invite.fornecedor_cnpj,
      'status', v_invite.status,
      'prazo_entrega', v_invite.prazo_entrega,
      'condicao_pagamento', v_invite.condicao_pagamento,
      'observacoes', v_invite.observacoes,
      'submitted_at', v_invite.submitted_at,
      'expires_at', v_invite.expires_at
    ),
    'requisition', jsonb_build_object(
      'id', v_requisition.id,
      'numero', v_requisition.numero,
      'facility_unit', v_requisition.facility_unit,
      'setor', v_requisition.setor,
      'data_requisicao', v_requisition.data_requisicao,
      'observacoes', v_requisition.observacoes
    ),
    'items', v_items,
    'responses', v_responses
  );
END;
$function$;