const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { descricao } = await req.json();
    if (!descricao || typeof descricao !== "string") {
      return new Response(JSON.stringify({ error: "descricao required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Pesquise preços de mercado para o produto hospitalar: "${descricao}".

REGRAS OBRIGATÓRIAS:
- Busque APENAS em sites de FABRICANTES e DISTRIBUIDORES/FORNECEDORES hospitalares brasileiros (ex.: Cremer, BD Becton Dickinson, Descarpack, Embramed, Medix, Cirúrgica Fernandes, Cirúrgica São José, Cirúrgica Mafra, Hospfar, Cremer, Polar Fix, Nipro, Solidor, Medsonda, Vitalmedical, etc.).
- Inclua portais B2B do setor de saúde (Bionexo, Hospitalar.com, ComprasNet, Banco de Preços em Saúde - BPS Ministério da Saúde, painel de preços do governo).
- NÃO use marketplaces genéricos como Mercado Livre, Amazon, Shopee, Magalu, Americanas, OLX, AliExpress.
- Priorize CNPJ/distribuidor real, fonte oficial e preço unitário em reais (apenas número, sem R$).
- Retorne até 5 ofertas reais com fornecedor (fabricante ou distribuidor), preço unitário e link direto da fonte.

Responda APENAS via tool call.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um assistente de pesquisa de preços hospitalares brasileiros. Busque exclusivamente em fabricantes, distribuidores especializados em saúde e portais oficiais (Bionexo, BPS/Ministério da Saúde, ComprasNet). NUNCA use marketplaces genéricos (Mercado Livre, Amazon, Shopee, Magalu, Americanas). Sempre responda usando a ferramenta fornecida." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_prices",
            description: "Reporta preços encontrados",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      fornecedor: { type: "string" },
                      preco: { type: "number" },
                      fonte_url: { type: "string" },
                    },
                    required: ["fornecedor", "preco"],
                  },
                },
              },
              required: ["results"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_prices" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let results: any[] = [];
    if (toolCall?.function?.arguments) {
      try { results = JSON.parse(toolCall.function.arguments).results || []; } catch { results = []; }
    }

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("price-search error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});