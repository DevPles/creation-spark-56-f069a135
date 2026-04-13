import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch contracts with notification_email
    const { data: contracts, error: cErr } = await supabase
      .from("contracts")
      .select("*")
      .not("notification_email", "is", null)
      .neq("notification_email", "");

    if (cErr) throw cErr;
    if (!contracts || contracts.length === 0) {
      return new Response(JSON.stringify({ message: "No contracts with notification email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const currentMonth = now.getMonth(); // 0-based
    const currentYear = now.getFullYear();
    const results: any[] = [];

    for (const contract of contracts) {
      const unit = contract.unit;
      const email = contract.notification_email;

      // 2. Fetch goals for this unit
      const { data: goals, error: gErr } = await supabase
        .from("goals")
        .select("*")
        .eq("facility_unit", unit);

      if (gErr || !goals || goals.length === 0) continue;

      // 3. For each goal, check current month entries
      const atRiskGoals: any[] = [];

      for (const goal of goals) {
        const { data: entries } = await supabase
          .from("goal_entries")
          .select("value, period")
          .eq("goal_id", goal.id);

        // Filter entries for current month/year
        const currentMonthEntries = (entries || []).filter((e) => {
          const p = e.period;
          let year: number, month: number;
          if (p.includes("/")) {
            const parts = p.split("/");
            if (parts.length === 3) {
              year = parseInt(parts[2]);
              month = parseInt(parts[1]) - 1;
            } else return false;
          } else if (p.includes("-")) {
            const parts = p.split("-");
            year = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1;
          } else return false;
          return year === currentYear && month === currentMonth;
        });

        const totalAchieved = currentMonthEntries.reduce((sum, e) => sum + Number(e.value), 0);

        // Weekly expected = target / 4
        const weekOfMonth = Math.ceil(now.getDate() / 7);
        const expectedByNow = (goal.target / 4) * weekOfMonth;

        if (totalAchieved < expectedByNow * 0.8) {
          // Below 80% of expected
          const pct = expectedByNow > 0 ? Math.round((totalAchieved / expectedByNow) * 100) : 0;
          atRiskGoals.push({
            name: goal.name,
            target: goal.target,
            achieved: totalAchieved,
            expected: Math.round(expectedByNow * 100) / 100,
            pct,
            risk: goal.risk,
            unit: goal.unit,
          });
        }
      }

      if (atRiskGoals.length === 0) continue;

      // 4. Build email HTML
      const totalRisk = atRiskGoals.reduce((s, g) => s + (g.risk || 0), 0);
      const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

      const goalsHtml = atRiskGoals.map((g) => `
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0">${g.name}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:center">${g.achieved} / ${g.expected} ${g.unit}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;color:${g.pct < 50 ? '#dc2626' : '#f59e0b'}">${g.pct}%</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right">R$ ${(g.risk || 0).toLocaleString("pt-BR")}</td>
        </tr>
      `).join("");

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1e40af;color:white;padding:20px;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:20px">⚠️ Alerta: Metas em Risco</h1>
            <p style="margin:8px 0 0;opacity:0.9">${contract.name} — ${unit}</p>
          </div>
          <div style="padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
            <p>Prezado(a) gestor(a),</p>
            <p>Identificamos <strong>${atRiskGoals.length} meta(s)</strong> com desempenho abaixo do esperado para ${monthNames[currentMonth]}/${currentYear}:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <thead>
                <tr style="background:#e2e8f0">
                  <th style="padding:8px;border:1px solid #cbd5e1;text-align:left">Meta</th>
                  <th style="padding:8px;border:1px solid #cbd5e1">Realizado / Esperado</th>
                  <th style="padding:8px;border:1px solid #cbd5e1">Atingimento</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;text-align:right">Risco (R$)</th>
                </tr>
              </thead>
              <tbody>${goalsHtml}</tbody>
            </table>
            <p style="font-weight:bold;color:#dc2626">Risco financeiro total: R$ ${totalRisk.toLocaleString("pt-BR")}</p>
            <p style="color:#64748b;font-size:12px;margin-top:24px">Este é um alerta automático do sistema MOSS. Acesse o sistema para mais detalhes.</p>
          </div>
        </div>
      `;

      // 5. Try to send via Resend or fallback to log
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const sendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "MOSS Sistema <noreply@onboarding.resend.dev>",
            to: [email],
            subject: `⚠️ Alerta: ${atRiskGoals.length} meta(s) em risco — ${contract.name}`,
            html,
          }),
        });
        const sendData = await sendRes.json();
        results.push({ contract: contract.name, email, atRiskGoals: atRiskGoals.length, sent: true, sendData });
      } else {
        // No email provider configured - just log
        console.log(`[check-goals-notify] Would send to ${email} for ${contract.name}: ${atRiskGoals.length} goals at risk`);
        results.push({ contract: contract.name, email, atRiskGoals: atRiskGoals.length, sent: false, reason: "no_email_provider" });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("check-goals-notify error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
