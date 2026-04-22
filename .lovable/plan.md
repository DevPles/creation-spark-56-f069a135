

# Módulo de Pedido de Compras

Criação de um módulo completo de Compras com 4 etapas (Requisição → Cotação → Banco de Preços → Ordem de Compra), integrado às rubricas dos contratos de gestão e com rastreabilidade total.

## Fluxo de negócio

```text
[Qualquer usuário]              [Compras / Gestor]                    [Gestor / Diretoria]
  REQUISIÇÃO  ─────────►  COTAÇÃO (3 fornecedores)  ─────────►  ORDEM DE COMPRA
  (itens, setor,            + Banco de Preços                   (consome rubrica
   classificação,           + Busca Google (IA)                   do contrato vinculado)
   justificativa)           ──► aponta MENOR PREÇO
                            ──► aponta CAMPEÃO
```

## Banco de dados (novas tabelas)

**`purchase_requisitions`** — requisição inicial
- `id`, `numero` (auto: 010/NNN/AAAA), `facility_unit`, `setor`, `municipio`
- `classificacao` (text[]: `medico`, `medicamento`, `dieta`, `higiene`, `escritorio`, `descartavel`, `limpeza`, `outros`)
- `justificativa_tipo` (`mensal`/`especifica`/`emergencial`/`outros`), `observacoes`
- `status` (`rascunho`/`aguardando_cotacao`/`em_cotacao`/`cotacao_concluida`/`em_oc`/`finalizada`/`cancelada`)
- `solicitante_id`, `solicitante_nome`, `aprovador_imediato_nome`, `aprovador_diretoria_nome`, `data_requisicao`, `created_by`

**`purchase_requisition_items`** — itens da requisição
- `id`, `requisition_id`, `item_num`, `descricao`, `quantidade`, `unidade_medida`, `observacao`

**`purchase_quotations`** — mapa de cotação (1:1 com requisição)
- `id`, `requisition_id`, `numero`, `created_by`, `setor_comprador`, `data_cotacao`, `status`
- `winner_supplier` (campeão por menor preço total), `total_winner` (numérico)

**`purchase_quotation_suppliers`** — até 3 fornecedores + extras (busca global)
- `id`, `quotation_id`, `slot` (`1`/`2`/`3`/`google`), `fornecedor_nome`, `fornecedor_cnpj`, `prazo_entrega`, `condicao_pagamento`, `fonte` (`manual`/`google_search`)

**`purchase_quotation_prices`** — preço por (item × fornecedor)
- `id`, `quotation_id`, `requisition_item_id`, `supplier_id`, `valor_unitario`, `valor_total` (calculado), `is_winner` (boolean — menor preço por item)

**`price_history`** — banco de preços (consultável)
- `id`, `descricao_produto`, `categoria`, `unidade_medida`, `valor_unitario`, `fornecedor_nome`, `fornecedor_cnpj`, `data_referencia`, `fonte` (`cotacao`/`oc`/`google`), `quotation_id`, `created_at`
- Trigger que insere automaticamente toda vez que uma cotação é salva ou OC emitida

**`purchase_orders`** — ordem de compra
- `id`, `numero`, `quotation_id`, `requisition_id`, `facility_unit`, `contract_id` (FK para contratos), `rubrica_id` (id da rubrica dentro do JSON do contrato — ex: `insumos`)
- `fornecedor_nome`, `fornecedor_cnpj`, `endereco_entrega`, `cnpj_emissao_nf`, `texto_obrigatorio_nf`, `prazo_entrega`
- `valor_total`, `status` (`aguardando_aprovacao`/`autorizada`/`negada`/`enviada`/`recebida`)
- `responsavel_emissao_nome`, `cargo`, `data_envio_fornecedor`, `data_envio_setor`
- `aprovado_por`, `aprovado_em`, `motivo_negacao`

**`purchase_order_items`** — congela itens autorizados (descrição, qtd, valor unt, total)

**`purchase_audit_log`** — trilha de auditoria (ação, usuário, timestamp, antes/depois) cobrindo as 4 entidades

### RLS
- SELECT: todos autenticados
- INSERT: `auth.uid() = created_by`
- UPDATE/Aprovação OC: `admin` ou `gestor`
- DELETE: `admin`

### Storage
- Novo bucket privado **`purchase-attachments`** para anexos de itens (especificações técnicas) e evidências de envio ao fornecedor (URLs assinadas, igual padrão OPME).

## Frontend

### Novo card "Compras" no Dashboard
Adicionado em `ALL_NAV_CARDS` (posição alfabética), rota `/compras`. Acesso amplo (qualquer usuário cria requisição); etapas restritas controlam ações.

### Nova página `/compras` — `ComprasPage.tsx`
Layout em **abas** (sem ícones, padrão MetricOss):

1. **Requisições** — Tabela (Nº, Data, Setor, Solicitante, Classificação, Status, Itens, Ações). Filtros: Unidade, Status, Período, Setor. Botão "Nova requisição" na mesma linha do título "Compras".
2. **Cotações** — Tabela das cotações com menor preço total e fornecedor campeão. Filtros idênticos.
3. **Banco de Preços** — Histórico pesquisável (descrição/fornecedor/categoria), com gráfico de evolução de preço por produto e botão "Buscar preços no Google" (edge function).
4. **Ordens de Compra** — Tabela (Nº, Fornecedor, Contrato, Rubrica, Valor, Status). Mostra **rubrica consumida vs. disponível** por OC.
5. **Painel** — KPIs: requisições abertas, cotações pendentes, OCs aguardando aprovação, gasto do mês por rubrica vs. orçamento.

### Modais (sem ícones)
- **`PurchaseRequisitionModal`** — capa (unidade auto, setor, classificação multi-checkbox, justificativa) + tabela de itens (adicionar/remover linhas) + assinaturas (solicitante/imediato/diretoria) + anexos.
- **`PurchaseQuotationModal`** — copia itens da requisição automaticamente; 3 colunas de fornecedor + 1 coluna opcional "Busca Google"; cada célula é o valor unitário; sistema marca **menor preço por item** (verde) e calcula **fornecedor campeão** (menor total geral).
- **`PriceSearchPanel`** (na aba Banco de Preços) — input de busca + edge function `price-search` (Lovable AI Gateway com `google/gemini-2.5-flash` + grounding) que retorna `[{fornecedor, preço, fonte_url}]` e salva em `price_history` com `fonte='google'`.
- **`PurchaseOrderModal`** — pré-preenche pelo fornecedor campeão da cotação. Seletor de **Contrato** (lista contratos da unidade) → seletor de **Rubrica** (popula do JSON `rubricas` do contrato) → exibe banner "Rubrica Insumos: R$ X gasto / R$ Y orçado (Z%)" calculado em tempo real (soma das OCs já autorizadas dessa rubrica vs. `valor * percent / 100` do contrato). Aprovação exige motivo (auditoria).

### Rastreabilidade
- Cada listagem mostra usuário/data/setor de origem.
- Aba "Histórico" em cada modal lê `purchase_audit_log` filtrado pela entidade.

## Edge Functions

- **`price-search`** — recebe `{ descricao }`, chama Lovable AI Gateway (`google/gemini-2.5-flash` com Google Search grounding) pedindo "preços brasileiros de [produto] com fornecedor e link". Retorna lista normalizada e persiste em `price_history`.
- **`purchase-order-authorize`** — valida saldo de rubrica, transiciona status, registra auditoria, dispara e-mail de notificação opcional.

## Integração com módulos existentes

- **Contratos** (`contracts.rubricas` + `rubrica_entries`): OCs autorizadas são contabilizadas como execução de rubrica (insert em `rubrica_entries` com `value_executed` = total da OC e `rubrica_name` = nome da rubrica selecionada). Assim a página Controle de Rubrica e os relatórios já existentes refletem automaticamente os gastos das OCs.
- **Logo Instituto Univida**: copiado para `src/assets/logo-univida.png` e adicionado ao cabeçalho da exportação PDF de Requisição, Mapa de Cotação e Ordem de Compra (mantendo o padrão Moss nas telas internas).

## Validações críticas

- Requisição não pode ir para cotação sem ao menos 1 item.
- Cotação não fecha sem ao menos 1 fornecedor com preços em todos os itens.
- OC não é autorizada se ultrapassar saldo da rubrica selecionada (alerta + bloqueio para não-admin).
- Toda mudança de status grava em `purchase_audit_log` com `motivo` obrigatório nas negações.

## Dados iniciais (seed)

Inserção de **2 requisições reais** completas no banco — equivalentes às planilhas enviadas (Material Médico Assistencial - 35 itens, e uma Compra Mensal de Medicamentos) — já com cotações simuladas em 3 fornecedores e 1 OC autorizada, para que a tabela inicial não fique vazia.

