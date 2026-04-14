import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const sectionTitle = String(body?.sectionTitle ?? "").trim();
    const sectionKey = String(body?.sectionKey ?? "").trim();
    const sectionDescription = String(body?.sectionDescription ?? "").trim();
    const unit = String(body?.unit ?? "").trim();
    const period = String(body?.period ?? "").trim();

    if (!sectionTitle || !unit || !period) {
      return new Response(JSON.stringify({ error: "sectionTitle, unit and period are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sectionContext = body?.sectionContext ?? {
      legacyContext: {
        goalSummary: body?.goalSummary ?? null,
        actionPlanSummary: body?.actionPlanSummary ?? null,
        sauSummary: body?.sauSummary ?? null,
        bedSummary: body?.bedSummary ?? null,
        rubricaSummary: body?.rubricaSummary ?? null,
      },
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const dataContext = JSON.stringify(
      { sectionKey, sectionTitle, sectionDescription, unit, period, sectionContext },
      null,
      2,
    );

    const systemPrompt = `Você é um analista institucional hospitalar especializado em relatórios assistenciais.
Sua tarefa é gerar EXATAMENTE 3 sugestões de texto analítico para a seção "${sectionTitle}" do relatório assistencial da unidade "${unit}", competência ${period}.

IDENTIFICAÇÃO DA SEÇÃO:
- chave interna: "${sectionKey || "não informada"}"
- título: "${sectionTitle}"
- descrição: "${sectionDescription || "não informada"}"

REGRAS OBRIGATÓRIAS:
1. Use APENAS os dados presentes em "DADOS DA SEÇÃO". É proibido citar números, setores, exames, leitos, SAU, planos de ação, metas, rubricas, documentos ou treinamentos que não apareçam nesse contexto.
2. Cada sugestão DEVE ser específica para a seção "${sectionTitle}" e permanecer 100% no eixo temático dessa seção.
3. Se o contexto indicar ausência de dados estruturados ou totais zerados, explicite isso de forma institucional, sem inventar números ou resultados.
4. Quando houver números, status, listas ou totais na própria seção, cite apenas esses dados reais.
5. Não reutilize textos de outras seções. Exemplo: treinamento não pode mencionar leitos; execução financeira não pode mencionar produção assistencial; documentação não pode mencionar SAU, salvo se isso estiver explicitamente no contexto recebido.
6. Use linguagem técnica, institucional e POSITIVA. Termos negativos como "queda", "piora", "risco", "glosa", "prejuízo" são PROIBIDOS.
7. Substitua situações desfavoráveis por: "potencial de crescimento", "oportunidade de fortalecimento", "espaço para evolução".
8. Cada sugestão deve ter entre 2 e 4 frases.

EIXOS TEMÁTICOS DE REFERÊNCIA:
- info_contrato/contract: dados contratuais e vigência
- caract_unidade/beds: leitos, capacidade instalada e movimentação assistencial
- producao_assistencial/goals: metas, setores, produção e atingimento
- indicadores_qualidade/sau: registros do atendimento ao usuário e resolutividade
- plano_acao/actionPlans: tratativas, prioridades, responsáveis e status
- indicadores_acompanhamento/goals_trend: comportamento agregado dos indicadores
- execucao_financeira/rubricas: rubricas e valores executados
- treinamentos: ações educativas, participantes, carga horária e público-alvo
- recursos_humanos: quadro de pessoal, cargos, turnos e quantitativos
- doc_regulatoria/doc_operacional: documentos, vigência, status e conformidade
- seg_trabalho: ocorrências, inspeções, providências e status
- servicos_terceirizados: fornecedores, escopo, status e conformidade

CATEGORIAS DAS 3 SUGESTÕES:
- "Desempenho Geral": Panorama do desempenho da unidade nesta seção específica.
- "Eficiência/Qualidade": Aspectos de eficiência, qualidade ou conformidade relevantes à seção.
- "Evolução/Oportunidade": Tendências positivas, oportunidades de crescimento ou consolidação.

Responda usando a tool suggest_texts.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `DADOS DA SEÇÃO (JSON):\n${dataContext}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_texts",
              description: "Return exactly 3 institutional analysis suggestions",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Category: Desempenho Geral, Eficiência/Qualidade, or Evolução/Oportunidade" },
                        text: { type: "string", description: "The suggestion text (2-4 sentences)" },
                      },
                      required: ["title", "text"],
                      additionalProperties: false,
                    },
                    minItems: 3,
                    maxItems: 3,
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_texts" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);
    const categoryFallback = ["Desempenho Geral", "Eficiência/Qualidade", "Evolução/Oportunidade"];
    const suggestions = Array.isArray(parsed?.suggestions)
      ? parsed.suggestions.slice(0, 3).map((item: any, index: number) => ({
          title: String(item?.title || categoryFallback[index]).trim() || categoryFallback[index],
          text: String(item?.text || "").trim(),
        }))
      : [];

    if (suggestions.length !== 3 || suggestions.some((item) => !item.text)) {
      throw new Error("Invalid suggestions payload");
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("report-suggestions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
