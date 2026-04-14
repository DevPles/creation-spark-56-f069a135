import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sectionTitle, goalSummary, actionPlanSummary, sauSummary, bedSummary, rubricaSummary, unit, period } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build a data context string from the summaries
    const dataLines: string[] = [];
    dataLines.push(`Unidade: ${unit}, Competência: ${period}`);

    if (goalSummary) {
      dataLines.push(`Metas: ${goalSummary.total} total, ${goalSummary.atingidas} atingidas (≥90%), ${goalSummary.parciais} parciais (60-89%), média geral ${goalSummary.avg}%`);
    }
    if (actionPlanSummary) {
      dataLines.push(`Planos de Ação: ${actionPlanSummary.total} total, ${actionPlanSummary.concluidas} concluídos, ${actionPlanSummary.emAndamento} em andamento`);
    }
    if (sauSummary) {
      dataLines.push(`SAU: ${sauSummary.total} registros, ${sauSummary.elogios} elogios, ${sauSummary.reclamacoes} reclamações, ${sauSummary.sugestoes} sugestões, ${sauSummary.resolvidos} resolvidos`);
    }
    if (bedSummary) {
      dataLines.push(`Leitos: ${bedSummary.total} total, internação: ${bedSummary.totalInternacao}, complementar: ${bedSummary.totalComplementar}`);
      if (bedSummary.movements) {
        dataLines.push(`Movimentação: ${bedSummary.movements.totalAdmissions} admissões, ${bedSummary.movements.totalDischarges} altas, ${bedSummary.movements.totalOccupied} pacientes-dia`);
      }
    }
    if (rubricaSummary) {
      dataLines.push(`Execução orçamentária: R$ ${Number(rubricaSummary.totalExecuted || 0).toLocaleString("pt-BR")}`);
    }

    const systemPrompt = `Você é um redator institucional especializado em relatórios assistenciais hospitalares.
Seu papel é gerar textos de valorização institucional para o campo "Análise e Complemento Manual" de relatórios assistenciais.

REGRAS OBRIGATÓRIAS:
- Máximo de 5 linhas por sugestão
- Linguagem técnica, objetiva e institucional
- Sempre baseada nos dados fornecidos (não generalize)
- Sem repetição entre sugestões
- PROIBIDO: linguagem de risco, termos negativos (queda, problema, falha, inconsistência), recomendações corretivas
- Utilizar linguagem de valorização: "evolução", "fortalecimento", "consistência", "ampliação", "desempenho"
- Quando houver variações nos dados, tratar como "oportunidade de expansão" ou "potencial de crescimento"
- Responda APENAS em JSON válido, sem markdown`;

    const userPrompt = `Seção do relatório: "${sectionTitle}"

Dados disponíveis:
${dataLines.join("\n")}

Gere exatamente 3 sugestões de texto:
1. Desempenho Geral: síntese dos principais indicadores com ênfase em volume, produtividade ou evolução
2. Eficiência/Qualidade: destaque de consistência, estabilidade operacional ou qualidade dos resultados
3. Evolução/Oportunidade Positiva: evidenciar crescimento, avanço ou potencial de ampliação de resultados

Responda em JSON: {"suggestions": [{"title": "...", "text": "..."}, ...]}`;

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
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_suggestions",
              description: "Return 3 institutional valorization text suggestions",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Short label: Desempenho Geral, Eficiência/Qualidade, or Evolução/Oportunidade" },
                        text: { type: "string", description: "The suggestion text, max 5 lines" },
                      },
                      required: ["title", "text"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_suggestions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar sugestões" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let suggestions = [];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      suggestions = parsed.suggestions || [];
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("report-suggestions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
