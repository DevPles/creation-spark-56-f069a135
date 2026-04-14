import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sectionTitle, goalSummary, actionPlanSummary, sauSummary, bedSummary, rubricaSummary, unit, period } =
      await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const dataContext = JSON.stringify(
      { sectionTitle, unit, period, goalSummary, actionPlanSummary, sauSummary, bedSummary, rubricaSummary },
      null,
      2,
    );

    const systemPrompt = `Você é um analista institucional hospitalar especializado em relatórios assistenciais.
Sua tarefa é gerar EXATAMENTE 3 sugestões de texto analítico para a seção "${sectionTitle}" do relatório assistencial da unidade "${unit}", competência ${period}.

REGRAS OBRIGATÓRIAS:
1. Cada sugestão DEVE ser específica para a seção "${sectionTitle}" — analise os dados fornecidos e descreva o que é relevante para ESTA seção.
2. Use linguagem técnica, institucional e POSITIVA. Termos negativos como "queda", "piora", "risco", "glosa", "prejuízo" são PROIBIDOS.
3. Substitua situações desfavoráveis por: "potencial de crescimento", "oportunidade de fortalecimento", "espaço para evolução".
4. Cite números reais dos dados fornecidos quando disponíveis (metas atingidas, leitos, movimentações, SAU, rubricas, planos de ação).
5. Se a seção não tiver dados automáticos relevantes, gere texto institucional contextualizado para o tema da seção.
6. Cada sugestão deve ter entre 2 e 4 frases.
7. NÃO repita o mesmo texto para seções diferentes — cada seção tem um foco distinto.

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
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dados do relatório para a seção "${sectionTitle}":\n${dataContext}` },
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
                    },
                    minItems: 3,
                    maxItems: 3,
                  },
                },
                required: ["suggestions"],
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

    return new Response(JSON.stringify({ suggestions: parsed.suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("report-suggestions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
