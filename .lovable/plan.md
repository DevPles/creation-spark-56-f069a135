

# Plano de Revisão Final — Sistema MOSS 100% Funcional

## Problemas Identificados

### 1. Filtros de ano/mês não funcionais em ControleRubricaPage (CRÍTICO)
Os filtros `selectedYear` e `selectedMonth` existem na UI mas **não afetam os dados**. O `byRubrica` e `byMonth` não filtram `rubricaEntries` por ano/mês — mostram sempre todos os lançamentos independente do filtro selecionado.

### 2. `rubricaData.ts` ainda existe (LIMPEZA)
O arquivo `src/data/rubricaData.ts` contém 95 linhas de dados fictícios. Nenhum arquivo importa mais este arquivo, mas ele permanece no projeto. Deve ser removido para evitar confusão.

### 3. `GENERATED_REPORTS` hardcoded em RelatoriosPage (MENOR)
Linha 54-58: lista estática de relatórios anteriores ("Consolidado Q1 2024", "RDQA 1º Quadrimestre"). Estes são exemplos visuais que não têm tabela de persistência. Opção: remover a seção ou criar tabela `generated_reports` para persistir PDFs gerados.

### 4. Timeline items hardcoded em RelatorioAssistencialPage (MENOR)
Linhas 79-86: items de timeline com dados de exemplo. Estes são **template editáveis** — o usuário pode editar inline para personalizar o relatório. Aceitável manter como defaults.

### 5. `period` format inconsistency em rubrica_entries
O `ControleRubricaPage` tenta parsear `period` como `dd/MM/yyyy`, mas o `LancamentoMetasPage` pode salvar em formato diferente (date picker retorna `yyyy-MM-dd`). Precisa normalizar.

---

## Plano de Correção (3 Etapas)

### Etapa 1: Corrigir filtros em ControleRubricaPage
- Filtrar `rubricaEntries` por `selectedYear` e `selectedMonth` nos cálculos `byRubrica` e `byMonth`
- Parsear o campo `period` corretamente independente do formato (dd/MM/yyyy ou yyyy-MM-dd)
- Incluir `selectedYear` e `selectedMonth` nas dependências dos `useMemo`

### Etapa 2: Remover dados mock residuais
- Deletar `src/data/rubricaData.ts`
- Remover `GENERATED_REPORTS` hardcoded e substituir por lista vazia (relatórios salvos poderão ser implementados futuramente)

### Etapa 3: Verificar consistência de formato de period
- Garantir que `LancamentoMetasPage` salva `period` de rubrica_entries em formato consistente
- Garantir que `ControleRubricaPage` parseia corretamente ambos formatos

---

## Resumo Técnico

```text
Arquivos a editar:
  - src/pages/ControleRubricaPage.tsx (filtros ano/mês funcionais)
  - src/pages/RelatoriosPage.tsx (remover GENERATED_REPORTS mock)

Arquivos a deletar:
  - src/data/rubricaData.ts
```

Impacto: Baixo risco. Correções pontuais em lógica de filtro sem alterar estrutura de banco.

