## Problema atual

Quando o **Médico Auditor** marca "Solicitar Justificativa ao Cirurgião" na Validação Pós-OP, o status vai para `aguardando_justificativa` e a Parte 4 abre direto na tela do **cirurgião**. Porém o fluxo está furado:

1. Quem entra no processo (qualquer perfil) cai direto na tela "Resposta à Auditoria" — não há gating por papel (cirurgião responde, auditor lê).
2. Após o cirurgião enviar a resposta, o sistema vai **direto** para `pendente_faturamento` — pulando a re-análise do auditor (linha 2932: `updateForm("status", "pendente_faturamento")`).
3. O auditor nunca tem a oportunidade de **ler a justificativa e decidir** se libera para faturamento ou reprova.
4. A justificativa do cirurgião é gravada em `incident_description` (campo reaproveitado de outro contexto) — ambíguo.
5. Não há registro de data/autor da resposta do cirurgião nem da decisão final do auditor sobre a justificativa.

## Fluxo correto a implementar

```text
Auditor Pós-OP marca "Solicitar Justificativa"
        │
        ▼
status = aguardando_justificativa
        │
        ▼  (Parte 4 / Step 0 — visível só para CIRURGIÃO/SOLICITANTE)
Cirurgião lê a solicitação + escreve justificativa + anexa evidência (opcional)
        │
        ▼
status = justificativa_respondida   (NOVO status)
        │
        ▼  (Parte 3 / Step 1 reaberta — visível só para AUDITOR)
Auditor lê a justificativa do cirurgião e decide:
  ├── "Liberar para Faturamento" → status = pendente_faturamento → Parte 4 / Step 1
  └── "Reprovar / Pedir nova justificativa" → volta a aguardando_justificativa
        │                                       (com novo motivo do auditor)
        ▼
Faturamento conclui → status = concluido
```

## Mudanças

### 1. Banco (migration)

- Adicionar valor ao enum `opme_status`: `'justificativa_respondida'`.
- Adicionar colunas em `opme_requests`:
  - `surgeon_justification text` — texto da resposta do cirurgião (substitui o uso ambíguo de `incident_description`).
  - `surgeon_justification_at timestamptz` — quando enviou.
  - `surgeon_justification_by text` — e-mail/nome do cirurgião que respondeu.
  - `surgeon_justification_attachments jsonb default '[]'::jsonb` — anexos opcionais.
  - `auditor_post_justification_decision text` — `'liberada'` | `'reprovada'`.
  - `auditor_post_justification_decision_at timestamptz`.
  - `auditor_post_justification_decision_notes text` — comentário do auditor ao decidir.
  - Histórico: `justification_round int default 0` — incrementa a cada novo pedido (permite múltiplas rodadas).

### 2. `src/pages/OpmeApp.tsx`

**a) Roteamento por status (`loadRequest`):**
- `aguardando_justificativa` → Parte 4, Step 0 (resposta do cirurgião).
- `justificativa_respondida` → Parte 3, Step 1 (auditor reanalisa) — abrir uma sub-view "Reanálise da Justificativa" ao invés do form em branco.

**b) Tela do Cirurgião (Parte 4 / Step 0) — refatorar:**
- Mostrar o **motivo do auditor** (já existe).
- Campo `surgeon_justification` em vez de `incident_description`.
- Mostrar histórico se for re-rodada (`justification_round > 0`): exibir todas as rodadas anteriores (motivo do auditor + resposta do cirurgião + decisão).
- Botão "Enviar Justificativa ao Auditor" → grava `surgeon_justification`, `surgeon_justification_at = now()`, `surgeon_justification_by = user.email`, status = `justificativa_respondida`.
- **NÃO** pular para faturamento.

**c) Tela do Auditor (Parte 3 / Step 1) — adicionar bloco "Análise da Justificativa do Cirurgião":**
- Visível **somente** quando `status === 'justificativa_respondida'` (ou quando há `surgeon_justification` preenchida em rodadas anteriores).
- Mostrar destacado: motivo solicitado + resposta do cirurgião + data/autor.
- Campo "Comentário do auditor sobre a justificativa".
- Dois botões claros:
  - **"Liberar para Faturamento"** → `auditor_post_justification_decision = 'liberada'`, status = `pendente_faturamento`.
  - **"Reprovar e solicitar nova justificativa"** → `decision = 'reprovada'`, incrementa `justification_round`, atualiza `auditor_post_justification_reason` com novo motivo, status volta para `aguardando_justificativa`.
- Exigir senha (já há fluxo `handleAuditAuth`) para ambas as decisões.

**d) Timeline / Status badges:**
- Adicionar label para `justificativa_respondida`: "Justificativa Recebida — Aguardando Reanálise".
- Atualizar a etapa 5 da timeline visual (linhas 2358–2370) para refletir as 4 fases: pedida → respondida → liberada/reprovada.

**e) Lista de trabalho (cards na home):**
- Filtros e contadores incluindo `justificativa_respondida` (alerta para o auditor agir).
- Cor distinta (ex: âmbar) para `aguardando_justificativa` (cirurgião) e azul para `justificativa_respondida` (auditor).

### 3. `src/integrations/supabase/types.ts`
- Será regenerado automaticamente após a migration.

### 4. Compatibilidade
- Registros antigos com `incident_description` preenchido continuam exibindo o texto como "justificativa legada" no painel do auditor (read-only fallback).

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — enum + colunas.
- `src/pages/OpmeApp.tsx` — roteamento, tela cirurgião, bloco auditor, botões de decisão, timeline, badges.

## Resultado para o usuário

O auditor pede justificativa → o cirurgião é o único que vê a tela de resposta → após enviar, o processo **volta** para o auditor com destaque visual → o auditor lê e decide explicitamente liberar ou pedir de novo → só então segue para faturamento. Cada rodada fica registrada com data, autor e decisão.
