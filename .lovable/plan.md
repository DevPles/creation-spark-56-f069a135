## Problemas a corrigir

A tela de "Justificativa do Cirurgião" (Parte 4 / Step 0) hoje:

1. Aceita só texto — sem anexar exames, etiquetas, fotos ou laudos. O auditor não tem evidência para reanalisar.
2. Mostra o botão "Próximo" do rodapé, permitindo que o cirurgião pule direto para a tela de Faturamento (Step 1) — exatamente o que não pode acontecer.
3. Mesmo após enviar a justificativa, o status `aguardando_justificativa`/`justificativa_respondida` poderia avançar para `concluido` se alguém forçasse um save da Parte 4. O fluxo correto exige que **só o auditor** decida liberar para Faturamento.

## Fluxo correto reforçado

```text
Auditor pede justificativa
        │
        ▼  Parte 4 / Step 0 — APENAS o cirurgião
Cirurgião:
  • lê a solicitação
  • escreve justificativa técnica
  • ANEXA evidências (1+ arquivo obrigatório: exames, etiqueta, foto, laudo, PDF…)
  • clica "Enviar Justificativa ao Auditor"
        │
        ▼ status = justificativa_respondida
Auditor (Parte 3 / Step 1) reanalisa → Liberar OU Reprovar/pedir nova
        │
        ▼ (só após "Liberar") status = pendente_faturamento
Faturamento conclui
```

A Parte 4 / Step 1 (Faturamento) **nunca** pode ser acessada enquanto o status for `aguardando_justificativa` ou `justificativa_respondida`.

## Mudanças

### 1. Tela do Cirurgião (Parte 4 / Step 0) — `src/pages/OpmeApp.tsx`

**Adicionar bloco "Evidências Anexadas":**
- Lista de anexos da rodada atual (estado `surgeonJustificationFiles`).
- Botão "Adicionar Evidência" abrindo `<input type="file">` com `accept="image/*,application/pdf"` e `multiple`.
- Cada item mostra nome, tamanho, miniatura (se imagem) e botão remover.
- Texto auxiliar: "Anexe exames, etiquetas de rastreabilidade, fotos do procedimento, laudos ou qualquer documento que comprove a justificativa."

**Validação para enviar:**
- Botão "Enviar Justificativa ao Auditor" só é habilitado quando:
  - `surgeon_justification.trim().length > 0` **E**
  - há pelo menos **1 anexo** com URL válida (após upload).
- Se faltar algum, exibir hint vermelho explicando o que falta.

**Persistência ao enviar:**
- Fazer upload de cada arquivo via `uploadFile` para o bucket `opme-attachments`.
- Gravar em `surgeon_justification_attachments` (jsonb já existente) array `[{ name, url, mime, size, uploaded_at }]`.
- Setar `surgeon_justification_at`, `surgeon_justification_by`, `status = "justificativa_respondida"` e chamar `handleSave(true)`.
- Limpar `surgeonJustificationFiles` após sucesso.

### 2. Render dos anexos no painel do Auditor (Parte 3 / Step 1)

No bloco amarelo "Reanálise — Justificativa do Cirurgião", abaixo de "Resposta enviada pelo cirurgião":
- Listar anexos clicáveis (abrir em nova aba). Imagens com thumbnail; PDFs com ícone.
- No histórico de rodadas anteriores também listar os anexos daquela rodada (preservar `attachments` em `justification_history` ao gerar `newEntry` nos botões "Liberar" e "Reprovar").

### 3. Bloquear atalhos do Cirurgião

No rodapé global (`<footer>`):
- Quando `part === 4 && step === 0` (justificativa), **esconder o botão "Próximo"** e o botão verde "Concluir Faturamento". Mostrar apenas "Sair" e a instrução "Use o botão 'Enviar Justificativa ao Auditor' acima". Isso impede que o cirurgião pule para o Step 1 (Faturamento).
- Em `loadRequest`, manter o roteamento atual: `aguardando_justificativa → Parte 4/Step 0`. Adicionar guarda em `next()`: se `part === 4 && step === 0 && status in ("aguardando_justificativa","justificativa_respondida")`, não avançar.

### 4. handleSave — proteção extra

Em `handleSave`, no ramo `part === 4`:
- Se `step === 0` e `status === "aguardando_justificativa"` → manter status como `justificativa_respondida` (cirurgião só envia, nunca conclui).
- Só permitir `nextStatus = "concluido"` quando `step === 1` **E** `status === "pendente_faturamento"`. Caso contrário, abortar com toast.

### 5. Banco

Nenhuma migração necessária — `surgeon_justification_attachments jsonb default '[]'` já existe. Reaproveitar bucket `opme-attachments`.

## Arquivos afetados

- `src/pages/OpmeApp.tsx` — bloco de upload no Step 0 do Part 4, render dos anexos no painel do auditor, persistência em `surgeon_justification_attachments`, ajuste do footer e guardas em `next()`/`handleSave`.

## Resultado para o usuário

1. Cirurgião abre a justificativa: vê o pedido do auditor, escreve a resposta e **é obrigado a anexar evidências** antes de poder enviar.
2. O botão "Próximo"/"Concluir Faturamento" desaparece nessa tela — não dá mais para pular para o faturamento.
3. Auditor recebe a resposta com todos os anexos visíveis e clicáveis, decide Liberar ou Reprovar.
4. Faturamento só fica acessível após o auditor liberar.
