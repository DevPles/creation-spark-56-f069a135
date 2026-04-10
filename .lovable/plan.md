## Plano: Nova aba "Movimentação de Leitos" em /lancamento

### Objetivo

Criar uma terceira aba no módulo de lançamentos para registrar diariamente a movimentação de leitos (internações, altas, óbitos, transferências e ocupação), calculando automaticamente taxa de ocupação e giro de leitos com base nos dados cadastrados e crie um senso dos lancamentos igual calendario para porder gerir isso por unidade

### 1. Nova tabela no banco de dados

Criar tabela `bed_movements` para registrar a movimentação diária:


| Coluna        | Tipo        | Descrição                 |
| ------------- | ----------- | ------------------------- |
| id            | uuid (PK)   | Identificador             |
| facility_unit | text        | Unidade                   |
| category      | text        | internacao / complementar |
| specialty     | text        | Especialidade do leito    |
| movement_date | date        | Data do registro          |
| occupied      | integer     | Leitos ocupados no dia    |
| admissions    | integer     | Internações no dia        |
| discharges    | integer     | Altas no dia              |
| deaths        | integer     | Óbitos no dia             |
| transfers     | integer     | Transferências no dia     |
| user_id       | uuid        | Quem registrou            |
| notes         | text        | Observações               |
| created_at    | timestamptz | Criação                   |


RLS: autenticados podem ler; inserir/atualizar apenas com `user_id = auth.uid()`; admins podem deletar.

### 2. Interface — Nova aba "Movimentação de Leitos"

- Adicionar aba `lancar-leitos` ao `TabsList` existente
- A aba mostra os leitos cadastrados para a unidade selecionada, agrupados por **categoria** (Internação / Complementar)
- Para cada especialidade, exibir uma linha com campos editáveis:
  - **Ocupados** | **Internações** | **Altas** | **Óbitos** | **Transferências**
- Seletor de data (dia) no topo da aba
- Botão "Salvar movimentação" que persiste todos os registros do dia

### 3. Indicadores calculados automaticamente

Na mesma aba, exibir cards de resumo:

- **Taxa de Ocupação** = (Total ocupados / Total leitos cadastrados) × 100
- **Giro de Leitos** = (Altas + Óbitos) / Total leitos cadastrados (acumulado no mês)
- **Saldo do dia** = Internações − (Altas + Óbitos + Transferências)

### 4. Histórico visível e editável

- Abaixo do formulário, mostrar tabela com os últimos lançamentos do mês filtrado
- Permitir clicar em um registro para editar os valores daquele dia
- Respeitar os filtros de Ano/Mês já existentes na página

### 5. Integração com relatórios

- Os gráficos de leitos em `/relatorios` passam a consumir dados reais da tabela `bed_movements` em vez de apenas `goal_entries`

### Detalhes técnicos

- Migração SQL para criar tabela + RLS policies
- Atualizar `LancamentoMetasPage.tsx` adicionando a aba com formulário, lógica de fetch/save e cards de indicadores
- Atualizar `RelatoriosPage.tsx` para buscar de `bed_movements`
- Tipos serão gerados automaticamente após migração