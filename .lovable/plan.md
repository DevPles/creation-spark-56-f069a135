

## Painel de Compras — Inteligência Operacional + Conformidade com Controle de Rubricas

Vamos transformar a aba **Painel** (hoje só 4 KPIs soltos) em um painel executivo completo, **totalmente alinhado ao card "Controle de Rubricas"** — usando exatamente a mesma fonte de verdade (orçamento contratado × execução real) para que os dois nunca divirjam.

### Princípio de conformidade com Controle de Rubricas

O card **Controle de Rubricas** já consolida, por contrato/unidade:
- **Orçamento da rubrica** = `contracts.value × (rubrica.percent / 100)`
- **Executado** = soma de `rubrica_entries.value_executed` (lançamentos reais) **+** OCs em `autorizada/enviada/recebida` por `contract_id + rubrica_id`
- **% consumido** e faixa de cor (verde <60% / amarelo 60–80% / vermelho >80%)

O Painel de Compras vai **reaproveitar exatamente esses cálculos** (mesma função utilitária, mesmas faixas de cor, mesmos rótulos) para que o gestor veja o mesmo número nos dois lugares.

### O que será construído

**1. KPIs operacionais (8 cards, 2 linhas)**
- Requisições abertas (rascunho + aguardando + em cotação) — variação vs mês anterior.
- Cotações em andamento — nº + tempo médio aberto (dias).
- OCs aguardando aprovação — destaque vermelho se alguma >3 dias.
- OCs autorizadas no mês.
- Convites enviados (mês) + taxa de resposta (`respondidos/enviados`).
- Ticket médio de OC.
- Total **autorizado** no mês (R$).
- Total **recebido** no mês (R$, status `recebida`).

**2. Funil de Compras (visual horizontal)**
`Requisições → Convites → Cotações → OCs Aguardando → Autorizadas → Recebidas`, com quantidade absoluta e taxa de conversão entre etapas.

**3. Gasto autorizado por mês (12 meses)**
Gráfico de barras/linha com `purchase_orders.valor_total` por mês.

**4. Bloco "Atenção Imediata" (lista priorizada e clicável)**
- Requisições em rascunho >5 dias.
- Cotações abertas >7 dias sem campeão.
- OCs aguardando aprovação >3 dias.
- Convites a expirar (<48h) sem resposta.
- **Rubricas com >80% do orçamento consumido** (cálculo idêntico ao Controle de Rubricas).

**5. Top 10 Fornecedores do período**
Nome · CNPJ · nº OCs · valor total autorizado · ticket médio · última OC · badge "Cadastrado" (se em `suppliers`).

**6. Top 10 Itens mais comprados**
Descrição · quantidade total · valor acumulado · preço médio · variação % vs período anterior (a partir de `purchase_order_items` cruzado com `price_history`).

**7. Conformidade Orçamentária — espelho do Controle de Rubricas (núcleo do painel)**
Para cada **contrato ativo**, lista de rubricas com:
- Rubrica · Orçamento (R$) · **Lançado** (`rubrica_entries`) · **Comprometido em OCs** (autorizada/enviada/recebida) · **Total executado** · **% consumido** · **Saldo disponível**.
- Barra de progresso com **as mesmas faixas de cor** do Controle de Rubricas (verde/amarelo/vermelho).
- Linha de alerta automático para itens >80% e estouro (>100%).
- Botão "Ver no Controle de Rubricas" → leva direto ao card correspondente, garantindo navegação cruzada.
- Totais por **contrato** e por **unidade** (somatório de orçamento × executado), reproduzindo a mesma agregação usada no card.

**8. Distribuição por Unidade e Status**
Barras horizontais: gasto autorizado por unidade · mini-distribuição: nº de OCs por status.

### Filtros do painel
- **Período**: Mês atual / 30 / 90 / 180 dias / Ano / Personalizado.
- **Unidade**: Todas / específica.
- Os mesmos filtros são aplicados ao bloco de Conformidade Orçamentária para que o resultado bata 1:1 com o que aparece em **Lançamentos → Controle de Rubricas** sob os mesmos filtros.

### Alterações técnicas

- **Novo**: `src/components/purchases/PurchasesDashboardPanel.tsx`.
- **Novo utilitário compartilhado**: `src/lib/rubricaBudget.ts` — função `computeRubricaConsumption({ contracts, rubricaEntries, purchaseOrders, period, unit })` reutilizada **tanto pelo Controle de Rubricas quanto pelo novo painel** (refator leve no card de Rubricas para passar a importar daqui — sem mudar comportamento).
- **`src/pages/ComprasPage.tsx`**: substituir o `<TabsContent value="painel">` atual por `<PurchasesDashboardPanel />`, passando `requisitions`, `quotations`, `orders`, `contracts`, `invitesByReq` por props (sem refetch).
- **Queries adicionais (React Query)**:
  - `purchase_order_items` (top itens).
  - `quotation_invites` completo (taxa de resposta + expiração).
  - `rubrica_entries` filtrado por período/unidade (para o bloco de conformidade).
  - `suppliers` (badge "Cadastrado").
- **Sem migrações novas**. Tudo a partir de tabelas existentes.
- Gráficos via `recharts` (já presente em `src/components/ui/chart.tsx`).

### Resultado para o gestor

- Abre **Compras → Painel** e enxerga, em uma tela: operação (gargalos, tempos, aprovações pendentes), gasto (mês a mês, por fornecedor, por item) e **conformidade orçamentária por rubrica idêntica ao Controle de Rubricas** — mesmos números, mesmas cores, mesmos limites de alerta.
- Clica em qualquer rubrica em alerta no painel → vai direto ao Controle de Rubricas para detalhar/lançar.

