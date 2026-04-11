

## Plano: Sistema Inteligente de Plano de Ação

### Problema atual
O módulo é 100% client-side com dados hardcoded. Não há persistência, histórico de tratativas, acompanhamento de evolução, análise por área/tipo, nem geração de relatórios. Ao recarregar a página, tudo se perde.

### Visão geral da solução

Criar um sistema completo e persistente de Plano de Ação com 5 pilares:

1. **Persistência no banco de dados** — tabela `action_plans` + `action_plan_history` para registrar cada mudança de status/tratativa
2. **Painel analítico com abas** — substituir a listagem simples por abas: Tratativas, Acompanhamento, Análise por Área, Relatórios
3. **Timeline de histórico** — cada plano terá uma timeline mostrando todas as alterações (quem, quando, o quê)
4. **Dashboard analítico** — gráficos de incidência/reincidência por tipo, área, unidade e período
5. **Relatórios inteligentes** — geração de relatório consolidado com IA que resume o cenário, destaca padrões e sugere prioridades

---

### Detalhes técnicos

#### 1. Novas tabelas (migrações)

**`action_plans`** — registro principal:
- `id`, `facility_unit`, `category` (meta/rubrica/justificativa/relatório), `reference_name` (meta ou rubrica vinculada), `reference_id` (goal_id opcional)
- `analise_critica`, `causa_raiz`, `acao_corretiva`, `responsavel`, `prazo`, `status_acao` (não iniciada/em andamento/concluída/cancelada)
- `status_evidencia` (pendente/enviada/validada/rejeitada), `tipo_evidencia`, `arquivo_url`
- `area` (setor/departamento), `tipo_problema` (enum: processo, equipamento, rh, insumo, infraestrutura, outro)
- `prioridade` (baixa/média/alta/crítica), `risco_financeiro` (valor numérico)
- `created_by`, `created_at`, `updated_at`

**`action_plan_history`** — log de cada alteração:
- `id`, `action_plan_id` (FK), `field_changed`, `old_value`, `new_value`, `changed_by`, `changed_at`, `notes`

RLS: autenticados podem ler; inserção/edição vinculada ao `created_by` ou admin.

#### 2. Página reestruturada com abas

- **Tratativas** (tab principal): listagem com filtros por status, prioridade, área, tipo de problema. Cards KPI no topo (total, pendentes, em andamento, concluídas, vencidas)
- **Acompanhamento**: visão Kanban ou timeline das tratativas agrupadas por status, com indicador de prazo (no prazo / atrasado / vencido)
- **Análise**: gráficos de barras/donut mostrando incidência por tipo de problema, por área/setor, por unidade; ranking de reincidência (mesma meta/rubrica com múltiplos planos); evolução mensal
- **Relatórios**: geração de relatório consolidado via IA que analisa os dados e produz um resumo executivo com padrões identificados, áreas críticas e recomendações

#### 3. Modal aprimorado

- Adicionar campos: `tipo_problema` (select), `área/setor` (select dinâmico da tabela sectors), `prioridade` (select)
- Seção de histórico dentro do modal: timeline com todas as alterações anteriores
- Ao salvar, registrar automaticamente em `action_plan_history`

#### 4. Edge function para relatório inteligente

- `supabase/functions/action-plan-report/index.ts` — recebe filtros (unidade, período), consulta os planos do banco, envia para Lovable AI e retorna um relatório estruturado com: resumo executivo, padrões de incidência, áreas com maior reincidência, recomendações priorizadas

#### 5. Arquivos impactados

- **Criar**: migração SQL, `src/pages/EvidenciasPage.tsx` (reestruturar), `src/components/ActionPlanTable.tsx`, `src/components/ActionPlanTimeline.tsx`, `src/components/ActionPlanAnalytics.tsx`, `src/components/ActionPlanReportTab.tsx`, `supabase/functions/action-plan-report/index.ts`
- **Editar**: `src/components/EvidenceFormModal.tsx` (novos campos + histórico inline)

