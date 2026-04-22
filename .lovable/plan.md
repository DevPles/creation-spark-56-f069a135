

## Portal de Cotação por Link Público

Permitir que, ao criar uma requisição, você envie um **link único** para cada fornecedor. O fornecedor abre o link (sem precisar de login), preenche valores unitários e disponibilidade dos itens, e envia. As respostas aparecem automaticamente no **Mapa de Cotação** da requisição correspondente.

### Fluxo proposto

```text
Requisição criada
   │
   ├─► Botão "Enviar para fornecedores"
   │     │
   │     ├─ Cadastra fornecedor (Nome, CNPJ, e-mail/WhatsApp)
   │     ├─ Sistema gera link único: /cotacao-publica/{token}
   │     └─ Copia link / envia por e-mail
   │
Fornecedor abre link
   │
   ├─► Vê dados da requisição (unidade, itens, qtd, unidade de medida)
   ├─► Preenche por item:
   │     - Valor unitário
   │     - Disponibilidade (sim/não)
   │     - Prazo entrega / Condição pagamento (geral)
   ├─► Confirma envio (uma vez só, depois link bloqueia)
   │
Comprador
   │
   └─► Mapa de Cotação mostra automaticamente as 3 propostas recebidas
        - Campeão calculado por menor total
        - Pode ainda editar/complementar manualmente
```

### Componentes a criar

**Backend (Lovable Cloud)**
- Nova tabela `quotation_invites`: `id`, `token` (uuid único, indexado), `requisition_id`, `fornecedor_nome`, `fornecedor_cnpj`, `fornecedor_email`, `status` (pendente / enviado / respondido / expirado), `prazo_entrega`, `condicao_pagamento`, `submitted_at`, `expires_at`, `created_by`, `created_at`
- Nova tabela `quotation_invite_responses`: `id`, `invite_id`, `requisition_item_id`, `valor_unitario`, `disponivel` (bool), `observacao`
- RLS:
  - `quotation_invites`: SELECT/INSERT/UPDATE para usuários autenticados (criadores/admin); **acesso público (anon)** somente via função RPC `get_invite_by_token(token)` que retorna dados não-sensíveis
  - `quotation_invite_responses`: INSERT público via RPC `submit_invite_response(token, responses[])` (SECURITY DEFINER, valida token ativo e não respondido)
- Após submissão, gatilho/RPC popula automaticamente `purchase_quotations` + `purchase_quotation_suppliers` + `purchase_quotation_prices` para a requisição

**Frontend autenticado (área comprador)**
- Em `PurchaseRequisitionModal` (ou na lista de requisições): novo botão **"Convidar fornecedores"**
- Novo modal `SupplierInviteModal.tsx`:
  - Lista convites já criados (status, link, data)
  - Botão **"Adicionar fornecedor"** → cadastra nome/CNPJ/e-mail e gera link
  - Botão **"Copiar link"** por convite
  - Botão **"Reenviar"** (regera token se necessário)

**Frontend público (fornecedor)**
- Nova rota `/cotacao-publica/:token` (sem `ProtectedRoute`)
- Nova página `PublicQuotationPage.tsx`:
  - Cabeçalho: nome do hospital/unidade, número da requisição, prazo
  - Tabela de itens (descrição, quantidade, unidade) + coluna "Valor unitário (R$)" editável + checkbox "Disponível"
  - Campos gerais: Prazo de entrega, Condição de pagamento, Observações
  - Botão **"Enviar proposta"** (valida obrigatórios, bloqueia reenvio)
  - Tela de confirmação após envio

**Mapa de Cotação (`PurchaseQuotationModal`)**
- Ao abrir uma requisição que possui convites respondidos: pré-preencher os 3 slots de fornecedores e os preços automaticamente
- Badge **"Recebido via link"** quando o slot vier de um convite
- Comprador ainda pode adicionar/editar fornecedores manualmente

### Detalhes técnicos

- Token: `gen_random_uuid()` (indexado, único)
- Expiração padrão: 7 dias (configurável)
- Após `submitted_at` preenchido, RPC bloqueia novas submissões com o mesmo token
- Acesso público sem autenticação usa apenas as RPCs `get_invite_by_token` e `submit_invite_response` (SECURITY DEFINER) — nenhuma tabela exposta diretamente ao role `anon`
- Auditoria: cada criação de convite e cada resposta gera entrada em `purchase_audit_log`
- Envio do link: nesta primeira fase apenas **copiar link** (fornecedor recebe por WhatsApp/e-mail manualmente). Se quiser disparo automático de e-mail depois, configuramos Lovable Emails em etapa separada.

### O que o usuário precisa decidir

