import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, modules } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!query || !modules || modules.length === 0) {
      return new Response(JSON.stringify({ results: [], suggestion: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const moduleList = modules.map((m: any, i: number) => `${i + 1}. "${m.title}" - ${m.description}`).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um assistente de um sistema de gestão hospitalar chamado MOSS. O sistema possui módulos de treinamento para ajudar os usuários.

Dado a dúvida do usuário, analise os módulos disponíveis e:
1. Ordene os módulos por relevância (do mais relevante ao menos)
2. Dê uma breve explicação de por que cada módulo é relevante
3. Se nenhum módulo for relevante, sugira uma frase de orientação

IMPORTANTE: Responda SEMPRE usando a ferramenta fornecida.`
          },
          {
            role: "user",
            content: `Dúvida do usuário: "${query}"\n\nMódulos disponíveis:\n${moduleList}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "rank_modules",
              description: "Retorna os módulos rankeados por relevância à dúvida do usuário",
              parameters: {
                type: "object",
                properties: {
                  ranked_indices: {
                    type: "array",
                    items: { type: "number" },
                    description: "Índices dos módulos (1-based) ordenados por relevância"
                  },
                  explanations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Explicação breve de relevância para cada módulo rankeado"
                  },
                  suggestion: {
                    type: "string",
                    description: "Sugestão ou orientação geral para o usuário baseada na dúvida"
                  },
                  has_relevant: {
                    type: "boolean",
                    description: "Se algum módulo é relevante para a dúvida"
                  }
                },
                required: ["ranked_indices", "explanations", "suggestion", "has_relevant"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "rank_modules" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar busca" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(JSON.stringify({ results: [], suggestion: "Não foi possível analisar sua dúvida. Tente reformular." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    
    return new Response(JSON.stringify({
      ranked_indices: parsed.ranked_indices,
      explanations: parsed.explanations,
      suggestion: parsed.suggestion,
      has_relevant: parsed.has_relevant,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("training-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
