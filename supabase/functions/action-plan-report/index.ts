import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { facility_unit, period } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine date filter
    let dateFilter: string | null = null;
    const now = new Date();
    if (period === "ultimo_mes") {
      dateFilter = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();
    } else if (period === "ultimo_trimestre") {
      dateFilter = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString();
    } else if (period === "ultimo_semestre") {
      dateFilter = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString();
    }

    let query = supabase.from("action_plans").select("*");
    if (facility_unit) query = query.eq("facility_unit", facility_unit);
    if (dateFilter) query = query.gte("created_at", dateFilter);

    const { data: plans, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    if (!plans || plans.length === 0) {
      return new Response(JSON.stringify({ report: "Não há planos de ação no período selecionado para gerar um relatório." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build summary for AI
    const summary = {
      total: plans.length,
      por_status: {} as Record<string, number>,
      por_tipo: {} as Record<string, number>,
      por_prioridade: {} as Record<string, number>,
      por_area: {} as Record<string, number>,
      por_unidade: {} as Record<string, number>,
      vencidos: 0,
      sem_responsavel: 0,
      reincidentes: {} as Record<string, number>,
    };

    plans.forEach((p: any) => {
      summary.por_status[p.status_acao] = (summary.por_status[p.status_acao] || 0) + 1;
      summary.por_tipo[p.tipo_problema] = (summary.por_tipo[p.tipo_problema] || 0) + 1;
      summary.por_prioridade[p.prioridade] = (summary.por_prioridade[p.prioridade] || 0) + 1;
      if (p.area) summary.por_area[p.area] = (summary.por_area[p.area] || 0) + 1;
      summary.por_unidade[p.facility_unit] = (summary.por_unidade[p.facility_unit] || 0) + 1;
      if (p.prazo && new Date(p.prazo) < now && p.status_acao !== "concluida") summary.vencidos++;
      if (!p.responsavel) summary.sem_responsavel++;
      summary.reincidentes[p.reference_name] = (summary.reincidentes[p.reference_name] || 0) + 1;
    });

    // Filter reincidentes
    const reincidentes = Object.entries(summary.reincidentes)
      .filter(([, v]) => v > 1)
      .sort((a, b) => b[1] - a[1]);

    const prompt = `Você é um consultor especializado em gestão hospitalar e contratos de gestão de saúde pública no Brasil.

Analise os seguintes dados de planos de ação e gere um RELATÓRIO EXECUTIVO em português do Brasil:

DADOS:
- Total de planos: ${summary.total}
- Por status: ${JSON.stringify(summary.por_status)}
- Por tipo de problema: ${JSON.stringify(summary.por_tipo)}
- Por prioridade: ${JSON.stringify(summary.por_prioridade)}
- Por área/setor: ${JSON.stringify(summary.por_area)}
- Por unidade: ${JSON.stringify(summary.por_unidade)}
- Planos vencidos sem conclusão: ${summary.vencidos}
- Planos sem responsável definido: ${summary.sem_responsavel}
- Referências com reincidência (múltiplos planos): ${JSON.stringify(reincidentes)}

Unidade filtrada: ${facility_unit || "Todas"}
Período: ${period}

Gere o relatório com as seguintes seções:
1. RESUMO EXECUTIVO (2-3 parágrafos)
2. PADRÕES IDENTIFICADOS (bullets)
3. ÁREAS CRÍTICAS (ranking com justificativa)
4. REINCIDÊNCIAS (destaque e recomendações)
5. RECOMENDAÇÕES PRIORIZADAS (5-8 ações ordenadas por urgência)
6. INDICADORES DE ATENÇÃO (métricas que precisam de monitoramento)

Use linguagem profissional e objetiva. Não invente dados, use apenas os fornecidos.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um consultor de gestão hospitalar brasileiro. Gere relatórios analíticos claros e acionáveis." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI error:", aiResponse.status, t);
      throw new Error("Falha ao gerar relatório com IA");
    }

    const aiData = await aiResponse.json();
    const report = aiData.choices?.[0]?.message?.content || "Não foi possível gerar o relatório.";

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
