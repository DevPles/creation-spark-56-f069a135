

## Dossiê de Auditoria da Ordem de Compra (Tribunal de Contas)

Adicionar, em **Compras → Ordens de Compra**, um novo botão **"Dossiê"** na coluna Ações que gera um documento PDF completo, oficial e auditável de todo o processo daquela OC — pronto para envio ao Tribunal de Contas. Também adicionar um **filtro por período (calendário)** na página.

---

### O que muda para o usuário

**1. Novo filtro de período (calendário) no topo da página**
- Componente `Popover` + `Calendar` em modo `range`, com botões rápidos: "Hoje", "Últimos 7 dias", "Mês atual", "Limpar".
- Aplica em todas as abas (Requisições, Cotações, Ordens) filtrando pela data principal de cada registro.

**2. Botão "Dossiê" na coluna Ações de Ordens de Compra**
- Ao clicar, abre modal com pré-visualização e botão **"Baixar PDF"**.
- Nome do arquivo: `Dossie_OC_[numero]_[data].pdf`.

**3. Conteúdo do Dossiê (PDF estruturado e numerado)**

**Capa**
- Marca Moss, número da OC, unidade hospitalar, fornecedor vencedor, valor total, data de emissão e data de geração do dossiê.

**Seção 1 — Histórico do processo (linha do tempo)**
- Requisição: criação (data/hora, solicitante, setor)
- Convites enviados aos fornecedores (data/hora, e-mail/telefone, status)
- Respostas recebidas via link público (data/hora, IP do envio)
- Cotações lançadas (manuais ou via link), com autor e data/hora
- Geração da OC (autor, data/hora)
- Aprovação/recusa pública (assinante, cargo, e-mail, IP, LGPD, data/hora)
- Mudanças de status posteriores
- Origem: `purchase_audit_log` + `quotation_invites` + `purchase_order_approvals` + `purchase_orders`.

**Seção 2 — Grade comparativa de preços e log de preenchimento**
- Tabela cruzada: itens × fornecedores, com preço unitário, total, prazo, condição e marcação do vencedor.
- Log detalhado por fornecedor:
  - Razão social e CNPJ
  - Origem (link público / manual)
  - Data e hora de envio da resposta
  - **Endereço IP** da máquina usada (capturado via header `x-forwarded-for` na submissão pública)
  - Quem lançou (nome do usuário, no caso de cotação manual)

**Seção 3 — Itens comprados**
- Tabela completa: nº, **código do produto** (do catálogo), descrição, quantidade, unidade, preço unitário, total, **setor solicitante** (do `purchase_requisitions.setor` e/ou `product_catalog.setor`).
- Quando houver foto cadastrada no catálogo, miniatura ao lado do código.

**Seção 4 — Aprovação e rastreabilidade legal**
- Dados completos do aprovador (nome, cargo, e-mail, IP, ciência LGPD, data/hora da assinatura).
- Contrato vinculado, rubrica utilizada, saldo da rubrica antes/depois.

**Rodapé em todas as páginas:** "Documento gerado automaticamente em DD/MM/AAAA HH:MM por [usuário] — Sistema MetricOss" + numeração de páginas.

---

### Detalhes técnicos

**Banco de dados**
- Adicionar coluna `submission_ip text` em `quotation_invite_responses` (e/ou em `quotation_invites` no `submitted_at`) para registrar o IP de envio.
- Atualizar a função RPC `submit_invite_response` para receber e gravar o IP (já existe parâmetro similar em `submit_order_approval`).
- Nova função RPC `get_order_dossier(_order_id uuid)` retornando JSON consolidado: ordem, itens (com `product_id` → catálogo para código/setor/imagem), requisição, convites + respostas (com IP/data/hora), cotação + suppliers + prices, aprovação, audit log filtrado pelas entidades relacionadas.

**Frontend**
- Novo componente `OrderDossierModal.tsx` em `src/components/purchases/`:
  - Chama a RPC e renderiza preview na tela.
  - Geração do PDF com **jsPDF + jspdf-autotable** (já compatível com o stack atual).
- `ComprasPage.tsx`:
  - Adicionar estado `dateRange: { from?: Date; to?: Date }` e `Popover` com `Calendar mode="range"` (com `pointer-events-auto`).
  - Aplicar `dateRange` em `filteredReqs`, `filteredQuotes`, `filteredOrders` (campos `data_requisicao`, `data_cotacao`, `created_at`).
  - Novo botão **"Dossiê"** (variant `outline`, rounded-full) na coluna Ações da tabela de Ordens, abrindo `OrderDossierModal`.

**Captura de IP**
- A página pública `PublicQuotationPage` ao chamar `submit_invite_response` enviará o IP obtido via serviço público leve (ex: `https://api.ipify.org?format=json`) como parâmetro adicional. Fallback: registra "não capturado".

---

### Arquivos afetados

- `supabase/migrations/` — nova coluna `submission_ip`, atualização de `submit_invite_response`, criação da RPC `get_order_dossier`.
- `src/pages/ComprasPage.tsx` — filtro de calendário (range) + botão "Dossiê" nas Ordens.
- `src/components/purchases/OrderDossierModal.tsx` — novo (preview + geração de PDF).
- `src/pages/PublicQuotationPage.tsx` — captura e envio do IP na submissão.

