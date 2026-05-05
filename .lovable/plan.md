# Plano final: Manual do Usuário + Peça de Vendas (Word)

Documento `.docx` único, profissional, em PT-BR, que funciona como **manual operacional** e ao mesmo tempo como **material comercial** para apresentação a contratantes.

## Diretrizes obrigatórias

- **Marca**: MetricOss / Moss. **Nunca** mencionar Lovable, Supabase, Vite, "low-code" ou qualquer ferramenta de geração. O produto é apresentado como software proprietário.
- **Stack descrita ao cliente** (linguagem comercial):
  - Frontend: React 18 + TypeScript, Tailwind CSS, arquitetura componentizada
  - Backend: **PostgreSQL** como banco de dados principal, com Row-Level Security nativo
  - Funções de servidor em **TypeScript/Deno** (edge functions) e rotinas agendadas em **SQL/pg_cron**
  - Geração de PDF server-side com **pdf-lib**, exportações com **Python** (analytics e relatórios)
  - Camada de IA via gateway próprio com modelos Gemini para NLP, sugestões e ranking
  - Autenticação JWT, criptografia em trânsito (TLS) e em repouso, conformidade LGPD
- **Tom**: técnico onde precisa, comercial onde vende. Cada módulo abre com um *pitch* curto antes do detalhe operacional.

## Estrutura do documento

1. **Capa institucional** — MetricOss, subtítulo "Plataforma de Gestão de Contratos de Saúde — Manual do Usuário e Visão de Produto", data, versão.
2. **Carta de apresentação** (1 página) — proposta de valor, dores que resolve, ROI esperado (redução de glosa, ciclo de faturamento, padronização entre unidades).
3. **Sumário executivo comercial** — 6 bullets de impacto: rastreabilidade total, defesa em auditoria, IA aplicada, multi-unidade, controle financeiro fracionado, mobile-ready.
4. **Sumário automático** (TOC).
5. **Arquitetura e Tecnologia** (1–2 páginas) — descrita conforme a stack acima, com tabela "Camada / Tecnologia / Benefício ao cliente".
6. **Papéis e Acessos** — Admin, Gestor, Analista, Clínico, Funcionário; matriz Papéis × Módulos.
7. **Como navegar** — TopBar, dashboard com cards arrastáveis, modais, padrão de filtros.
8. **Módulos** (11 seções, mesma estrutura cada uma):
   - **Pitch comercial** (3–5 linhas)
   - **Objetivo operacional**
   - **Quem acessa**
   - **Telas, abas, formulários e campos**
   - **Fluxos passo-a-passo**
   - **Regras de negócio**
   - **Ganho operacional** (KPIs: redução de glosa, tempo, padronização, defesa em auditoria)
   - **Inteligência lógica aplicada (backend)** — tabelas PostgreSQL, RLS, triggers/funções SQL, jobs `pg_cron`, edge functions, scripts Python, fórmulas, IA
   - **Saídas** (PDFs, dossiês, notificações)
9. **Anexos**:
   - Glossário
   - Matriz Papéis × Módulos
   - Mapa técnico: Tabela / Função / Job agendado / Edge function / Script Python por módulo
   - Política de segurança (LGPD, RLS, auditoria)
   - Roadmap e diferenciais competitivos (página final de venda)
10. **Contracapa** — contato comercial e selo "MetricOss — Tecnologia em Gestão de Saúde".

## Cobertura por módulo (11)

Compras · Contratos · Metas e Indicadores · Plano de Ação · Relatórios · Administração · Lançamentos · SAU · Relatório Assistencial · Controle de Rubrica · Gestão de OPME

Para cada um, "Ganho operacional" + "Inteligência lógica" são parágrafos densos. Exemplos:

- **Compras** — Pitch: "Da requisição ao dossiê auditável em um único fluxo." Backend: tabelas `purchase_requisitions`, `quotations`, `orders` em PostgreSQL com RLS por unidade; edge functions em TypeScript/Deno (`price-search`, `requisition-invite`); banco histórico de preços; geração de PDF temático.
- **Contratos** — Rubricas com soma 100% validada por trigger SQL; rotina semanal `pg_cron` (`check-goals-notify`) dispara e-mail quando atingimento proporcional <80%.
- **Metas/Indicadores** — 4 visões; projeção linear calculada a partir do histórico; normalização "própria meta" vs "global".
- **Plano de Ação** — Pareto + Ishikawa, IA Gemini para insights, "Cenário de Risco" derivado de `risk_calculation` (TypeScript determinístico).
- **Relatórios** — agregadores SQL, modo fullscreen rotativo 5s, exportação PDF e dados brutos para análise em Python.
- **Administração** — `user_roles` separada com enum `app_role`, função `has_role` SECURITY DEFINER (anti-recursão RLS), hierarquia via `supervisor_id`.
- **Lançamentos** — entrada unificada com filtros encadeados; validação por `period` (dd/MM/yyyy como fonte única de verdade).
- **SAU** — ouvidoria categorizada por unidade com RLS.
- **Relatório Assistencial** — compilador mensal híbrido, snapshot JSON em storage, IA gera 3 sugestões positivas anti-glosa.
- **Controle de Rubrica** — projeção de risco com Percentual Variável real.
- **Gestão de OPME** — dossiê auditável ponta-a-ponta, duplo check de localização cirúrgica, anexos versionados, convite ao médico via edge function, log de auditoria persistente com motivo obrigatório (PDF unificado via pdf-lib).

## Geração

- skill `docx` (docx-js): A4, 1" margens, Calibri/Cambria nos títulos, Arial corpo 11pt
- TOC automática com `outlineLevel`
- Tabelas com `WidthType.DXA`, `ShadingType.CLEAR`, paleta teal MetricOss (#0D9488 / #115E59)
- Cabeçalho "MetricOss — Manual do Usuário" e rodapé com paginação
- Conteúdo extraído de `src/pages/*`, modais e edge functions reais (sem inventar funcionalidades)

## QA

- `validate_document.py`
- Converter para PDF com LibreOffice e inspecionar capa, meio e últimas páginas
- Conferir que **nenhuma menção** a Lovable/Supabase/Vite aparece no texto
- Re-gerar até estar limpo

## Entrega

- `/mnt/documents/Manual_MetricOss.docx`
- Apresentado via `<lov-artifact>` para download

Estimativa: 60–90 páginas. Após sua aprovação eu gero em uma única passada.
