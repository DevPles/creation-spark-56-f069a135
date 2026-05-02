-- Tabela de convites para preenchimento de Requisição via link público
CREATE TABLE public.opme_requisition_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opme_request_id UUID NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  last_filled_at TIMESTAMP WITH TIME ZONE,
  last_doctor_name TEXT,
  last_doctor_crm TEXT,
  fill_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_opme_req_invites_request ON public.opme_requisition_invites(opme_request_id);
CREATE INDEX idx_opme_req_invites_token ON public.opme_requisition_invites(token);

ALTER TABLE public.opme_requisition_invites ENABLE ROW LEVEL SECURITY;

-- Apenas autenticados criam convites para si
CREATE POLICY "Authenticated can insert invites"
  ON public.opme_requisition_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Autenticados podem ver os convites (para listar/revogar)
CREATE POLICY "Authenticated can view invites"
  ON public.opme_requisition_invites
  FOR SELECT
  TO authenticated
  USING (true);

-- Criador ou admin podem deletar (revogar)
CREATE POLICY "Owner or admin can delete invites"
  ON public.opme_requisition_invites
  FOR DELETE
  TO authenticated
  USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));

-- Edge function (service role) gravará atualizações em last_*; nenhum UPDATE para usuários comuns