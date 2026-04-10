## Assistente Guiado (Wizard) - Central do Sistema

### Conceito

Criar um card central destacado no Dashboard chamado **"Assistente "** (ou similar). Ao clicar, o usuário é levado a uma página `/assistente` com um fluxo estilo SurveyMonkey - navegação por etapas com cards explicativos, onde cada escolha leva a sub-opções ou abre os modais já existentes no sistema, nao use icones!!!

### Estrutura do Fluxo

```text
Dashboard
  └── Card "Central de Ações" (destaque central)
        └── /assistente (página wizard)
              ├── Etapa 1: "O que deseja fazer?"
              │   ├── 📋 Cadastrar / Lançar dados
              │   ├── 📊 Consultar informações
              │   └── 📄 Gerar relatórios
              │
              ├── Se "Cadastrar / Lançar dados":
              │   ├── Cadastrar Meta → abre GoalFormModal
              │   ├── Lançar Rubrica → abre RubricaFormModal
              │   ├── Registrar Leitos → abre modal de leitos
              │   ├── Cadastrar Contrato → abre ContractFormModal
              │   └── Enviar Evidência → abre EvidenceFormModal
              │
              ├── Se "Consultar informações":
              │   ├── Ver Metas → abre GoalModal (leitura)
              │   ├── Ver Contratos → abre ContractModal
              │   ├── Ver Rubricas → navega inline
              │   └── Ver Riscos → abre RiskModal
              │
              └── Se "Gerar relatórios":
                  └── Abre PdfExportModal
```

### Detalhes Técnicos

1. **Dashboard (`Dashboard.tsx`)**: Adicionar um card centralizado e visualmente destacado (gradiente, ícone, tamanho maior) entre os KPI cards e os nav cards, que navega para `/assistente`.
2. **Nova página `src/pages/AssistentePage.tsx**`:
  - Estado `step` controla a etapa atual e `history` permite voltar.
  - Cada etapa renderiza cards animados (framer-motion) com título, descrição explicativa do que aquela ação faz.
  - Botão "Voltar" para retornar à etapa anterior.
  - Ao chegar na ação final, abre o modal correspondente (reutilizando `GoalFormModal`, `ContractFormModal`, `RubricaFormModal`, `EvidenceFormModal`, `PdfExportModal`, etc.).
  - Barra de progresso visual mostrando em qual etapa o usuário está.
3. **Rota (`App.tsx`)**: Adicionar `<Route path="/assistente" element={<ProtectedRoute><AssistentePage /></ProtectedRoute>} />`.
4. **Estilo dos cards do wizard**: Cards grandes com ícone, título em negrito e descrição de 1-2 linhas explicando o que acontece ao clicar, com hover suave e animação de entrada.

### Arquivos a Criar/Editar

- **Criar**: `src/pages/AssistentePage.tsx`
- **Editar**: `src/pages/Dashboard.tsx` (card central)
- **Editar**: `src/App.tsx` (nova rota)