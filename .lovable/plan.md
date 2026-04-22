

## Banco de Preços por Fornecedor

Hoje o **Banco de Preços** (`price_history`) só guarda o histórico de preços por descrição do produto, sem um cadastro estruturado de fornecedores. Vamos transformá-lo num histórico **organizado por fornecedor (CNPJ)**, com filtro dedicado e visualização cronológica.

### O que será construído

**1. Cadastro de Fornecedores (nova tabela `suppliers`)**
- Campos: `id`, `nome`, `cnpj` (único), `email`, `telefone`, `endereco`, `contato_responsavel`, `ativo`, `created_at/by`.
- CNPJ é a chave de identificação. Um fornecedor = um CNPJ.
- Acessível via novo sub-painel **"Fornecedores"** dentro da aba Banco de Preços (botão "Gerenciar fornecedores").

**2. Vínculo automático preço → fornecedor**
- Adicionar coluna `supplier_id` em `price_history`.
- Sempre que um preço entrar no banco (cotação manual, cotação via link, ou cadastro avulso), o sistema:
  - Procura o fornecedor pelo **CNPJ informado**.
  - Se existir → reaproveita (`supplier_id` = existente).
  - Se não existir → cria automaticamente o fornecedor com o nome/CNPJ recebidos.
- Resultado: cada novo preço daquele CNPJ se acumula no mesmo "perfil" do fornecedor.

**3. Filtro por fornecedor na aba Banco de Preços**
- Ao lado do filtro de **Unidade**, adicionar filtro **Fornecedor** (dropdown alfabético com nome — CNPJ).
- Filtros combinam: Unidade + Fornecedor + busca por descrição.
- Adicionar também um seletor rápido de **período** (últimos 30/90/180 dias / personalizado).

**4. Visão "Histórico do fornecedor"**
- Quando um fornecedor é selecionado, o painel troca para uma visão dedicada:
  - **Cabeçalho**: nome, CNPJ, contato, total de itens cotados, último preço enviado.
  - **Tabela agrupada por produto** com colunas: Descrição · Última cotação · Preço atual · Variação (%) vs cotação anterior · Nº de cotações.
  - Ao clicar num produto → expande mostrando **todas as datas e preços** daquele item para aquele fornecedor (linha do tempo).
- Sem fornecedor selecionado → mantém a visão atual (lista geral de preços).

**5. Integração com cotações existentes**
- `submit_invite_response` (cotação por link) e o salvamento de cotação manual passam a chamar o mesmo helper `upsert_supplier_and_price`, garantindo que todo preço capturado já caia no fornecedor certo.

### Alterações técnicas

- **Migração SQL:**
  - `CREATE TABLE public.suppliers` + RLS (view: authenticated; insert/update: authenticated; delete: admin) + índice único em `cnpj`.
  - `ALTER TABLE price_history ADD COLUMN supplier_id uuid` + índice.
  - Função `upsert_supplier_from_cnpj(_nome, _cnpj) RETURNS uuid` (SECURITY DEFINER) para resolver/criar fornecedor.
  - Backfill: popular `suppliers` a partir dos CNPJs já existentes em `price_history` e preencher `supplier_id` retroativamente.

- **Frontend:**
  - `src/components/purchases/PriceBankPanel.tsx`: adicionar filtro de fornecedor, modo "Histórico do fornecedor" e expansão por produto.
  - Novo `src/components/purchases/SupplierRegistryModal.tsx`: CRUD de fornecedores (lista, novo, editar, desativar).
  - `src/components/purchases/PurchaseQuotationModal.tsx`: ao salvar cotação manual, chamar `upsert_supplier_from_cnpj` antes de inserir em `price_history`.
  - Edge logic / RPC de cotação por link já é central — atualizar `submit_invite_response` para também alimentar `price_history` com `supplier_id` resolvido.

### Comportamento final

- Cadastrei "Cirúrgica Mafra — CNPJ 12.345…" uma vez.
- Toda nova cotação recebida desse CNPJ (manual, link, ou registro avulso) **atualiza o histórico desse fornecedor automaticamente**.
- Em **Banco de Preços**, filtro por **Cirúrgica Mafra** → vejo todos os itens já cotados por ele, com o preço mais recente, variação e a linha do tempo de cada produto.

