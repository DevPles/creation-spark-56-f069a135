

## Plano: Seletor de Visão Cards vs Lista/Calendário na página de Metas

### O que muda para o usuário
Um toggle (ícone de grid / ícone de lista) aparecerá ao lado dos filtros existentes. Ao alternar:
- **Visão Cards** (atual): grid de cards com gauge, faixas de glosa, etc.
- **Visão Lista**: tabela compacta estilo calendário mostrando para cada meta uma linha com:
  - Nome da meta, tipo, unidade
  - Meta total e meta diária calculada
  - Realizado acumulado
  - Déficit (meta acumulada até hoje - realizado)
  - Barra de progresso visual (% atingimento)
  - Dias restantes
  - Status (cor verde/amarelo/vermelho)

Os cálculos usam os mesmos dados já carregados (goals + goal_entries): meta diária = target / dias do período; meta acumulada até hoje = meta diária x dias decorridos; déficit = meta acumulada - current.

### Detalhes técnicos

**Arquivo: `src/pages/MetasPage.tsx`**
- Adicionar estado `viewMode: "cards" | "list"` 
- Adicionar toggle com ícones LayoutGrid / List ao lado dos filtros
- Quando `viewMode === "list"`, renderizar um novo componente `GoalListView`
- Quando `viewMode === "cards"`, manter o grid atual

**Novo arquivo: `src/components/GoalListView.tsx`**
- Recebe a lista de goals filtradas e callbacks (onView, onEdit)
- Renderiza uma tabela responsiva com as colunas:
  - Meta | Tipo | Realizado | Meta Total | Meta Diária | Acumulado Esperado | Déficit | % | Dias Restantes
- Cálculos:
  - `daysTotal` = diferença entre startDate e endDate
  - `daysElapsed` = diferença entre startDate e hoje
  - `dailyTarget` = target / daysTotal
  - `expectedAccum` = dailyTarget x daysElapsed  
  - `deficit` = expectedAccum - current
- Barra de progresso inline com cor condicional
- Linha clicável para abrir o modal de detalhes

Nenhuma alteração no banco de dados. Usa exclusivamente os dados já carregados.

