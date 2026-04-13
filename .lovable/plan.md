

# Plano de Revisão Completa do Sistema MOSS

## Problemas Identificados

### 1. Dados Mock ainda presentes (CRÍTICO)
Várias páginas ainda usam dados hardcoded em vez de consultar o banco de dados:

- **RelatoriosPage.tsx**: Usa `CONTRACTS` com dados mock (3 contratos hardcoded com metas, performance, riskTrend). Deveria usar a tabela `contracts` + `goals` + `goal_entries` do banco.
- **ControleRubricaPage.tsx**: `RISK_DATA` é hardcoded. A rubrica usa dados dos contratos do banco mas simula a execução com `executionRate` calculado artificialmente (linhas 73-76). Deveria ter uma tabela `rubrica_entries` para lançamentos reais.
- **RiscoPage.tsx**: `RISK_DATA` é 100% hardcoded. Deveria calcular riscos a partir de `goals` + `goal_entries`.
- **RelatorioAssistencialPage.tsx**: `GOALS_DATA` é hardcoded por unidade. Deveria usar `goals` + `goal_entries`.
- **LancamentoMetasPage.tsx (aba Rubricas)**: Usa `CONTRACTS` e `ALL_ENTRIES` do `rubricaData.ts` (mock). O `handleRubricaSubmit` apenas mostra toast sem salvar no banco.
- **rubricaData.ts**: Arquivo inteiro de dados fictícios usado por múltiplas páginas.

### 2. Tabela de Lançamento de Rubricas inexistente (CRÍTICO)
Não existe tabela `rubrica_entries` no banco. Os lançamentos de rubricas na aba "Lançamento de Rubricas" não são persistidos — apenas exibem um toast de sucesso falso.

### 3. SAU Page sem funcionalidade
Página apenas exibe "Módulo em construção". Precisa de tabela e CRUD.

### 4. Filtros não funcionais em algumas páginas
- **ControleRubricaPage**: Filtros de ano e mês existem mas não afetam os dados (dados são simulados).
- **RelatoriosPage**: Dados são mock, filtros não têm efeito real.

### 5. goal_entries filtra apenas por user_id
Na LancamentoMetasPage (linha 630), `goal_entries` só busca entradas do próprio usuário. Admins deveriam ver todas as entradas.

---

## Plano de Implementação (6 Etapas)

### Etapa 1: Criar tabela `rubrica_entries`
- Migration SQL para criar tabela com campos: `id`, `contract_id`, `rubrica_name`, `value_executed`, `period`, `notes`, `user_id`, `facility_unit`, `created_at`
- RLS: authenticated SELECT, INSERT por user_id, UPDATE por user_id

### Etapa 2: Criar tabela `sau_records` para SAU
- Migration SQL: `id`, `facility_unit`, `tipo` (ouvidoria/elogio/reclamação/sugestão), `descricao`, `status`, `responsavel`, `created_by`, `created_at`, `resolved_at`
- RLS com políticas adequadas

### Etapa 3: Conectar LancamentoMetasPage (aba Rubricas) ao banco
- Substituir `CONTRACTS` mock pelos contratos do `useContracts()`
- `handleRubricaSubmit` → INSERT real na tabela `rubrica_entries`
- Exibir lançamentos anteriores da tabela
- Corrigir filtro de `goal_entries` para admins verem todas as entradas

### Etapa 4: Conectar ControleRubricaPage ao banco
- Substituir `RISK_DATA` por cálculo real de `goals` + `goal_entries`
- Substituir simulação de execução por dados reais de `rubrica_entries`
- Garantir que filtros de ano/mês funcionem

### Etapa 5: Conectar RelatoriosPage e RelatorioAssistencialPage ao banco
- Substituir `CONTRACTS` mock por dados reais de `contracts` + `goals` + `goal_entries`
- Calcular performance, riskTrend e stats dinamicamente
- Garantir que PDFs gerados usem dados reais

### Etapa 6: Conectar RiscoPage ao banco + Implementar SauPage
- RiscoPage: calcular riscos a partir de `goals` + `goal_entries`
- SauPage: CRUD completo com formulário, listagem, filtros por unidade e status

---

## Resumo Técnico

```text
Arquivos a criar:
  - 1 migration (rubrica_entries + sau_records)

Arquivos a editar:
  - src/pages/LancamentoMetasPage.tsx (rubrica submit real, entries sem filtro user)
  - src/pages/ControleRubricaPage.tsx (dados reais)
  - src/pages/RelatoriosPage.tsx (dados reais)
  - src/pages/RelatorioAssistencialPage.tsx (dados reais)
  - src/pages/RiscoPage.tsx (dados reais)
  - src/pages/SauPage.tsx (CRUD completo)
  - src/data/rubricaData.ts (pode ser removido ou mantido como fallback)
```

Cada etapa será implementada sequencialmente para evitar quebras. A ordem prioriza as funcionalidades mais críticas (persistência de dados) antes das páginas de visualização.

