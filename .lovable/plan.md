

# Plano de Revisão Final — Sistema MOSS

## Problemas Identificados

### 1. Performance e riskTrend fabricados em RelatoriosPage (CRÍTICO)
Linhas 548-556: `performance` e `riskTrend` são gerados com dados sintéticos fixos ("Jan", "Fev", "Mar", "Abr") usando cálculos artificiais com fator `(1 - i * 0.1)`. Não refletem dados reais por mês. Devem ser computados a partir de `goal_entries` agrupados por mês/período.

### 2. Sem filtro de período no RelatoriosPage
A página tem um seletor `period` ("4M") que não afeta nenhum dado — é puramente decorativo. Os dados não são filtrados por período.

### 3. GoalItem.rubrica sempre "Metas" (MENOR)
Linha 540: `rubrica: "Metas"` — hardcoded. O radar de rubricas nunca mostra dados reais porque nenhuma goal tem rubrica correspondente ao nome da rubrica do contrato. Sem campo de rubrica na tabela `goals`, este dado deve ser calculado ou removido do radar.

## Plano de Correção (2 Etapas)

### Etapa 1: Corrigir performance e riskTrend em RelatoriosPage
- Computar `performance` real: agrupar `goal_entries` por mês, calcular % atingidas/parciais/críticas para cada mês que tem lançamentos
- Computar `riskTrend` real: calcular risco por mês baseado no gap entre lançado e meta proporcional
- Conectar o filtro `period` para filtrar os meses mostrados (4M = últimos 4 meses, etc.)

### Etapa 2: Corrigir radar de rubricas
- Como não existe campo `rubrica` na tabela `goals`, remover o radar ou substituí-lo por dados reais de execução de rubricas (`rubrica_entries` vs alocação do contrato)

## Resumo Técnico

```text
Arquivos a editar:
  - src/pages/RelatoriosPage.tsx (performance/riskTrend reais + filtro período)
```

Impacto: Médio. Alteração de lógica de computação dos dados de gráficos sem mudança de DB.

