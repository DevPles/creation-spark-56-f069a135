import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AutoDataPayload } from "./types";

export function useAutoData(unit: string, contractId: string) {
  const [autoData, setAutoData] = useState<AutoDataPayload>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contractId || !unit) return;
    const load = async () => {
      setLoading(true);
      try {
        const [goalsR, entriesR, plansR, sauR, bedsR, bedMovR, rubR, sectorsR] = await Promise.all([
          supabase.from("goals").select("*").eq("facility_unit", unit as any),
          supabase.from("goal_entries").select("*"),
          supabase.from("action_plans").select("*").eq("facility_unit", unit),
          supabase.from("sau_records").select("*").eq("facility_unit", unit),
          supabase.from("beds").select("*").eq("facility_unit", unit),
          supabase.from("bed_movements").select("*").eq("facility_unit", unit),
          supabase.from("rubrica_entries").select("*").eq("facility_unit", unit),
          supabase.from("sectors").select("*").eq("facility_unit", unit),
        ]);
        setAutoData({
          goals: goalsR.data || [],
          entries: entriesR.data || [],
          actionPlans: plansR.data || [],
          sauRecords: sauR.data || [],
          beds: bedsR.data || [],
          bedMovements: bedMovR.data || [],
          rubricaEntries: rubR.data || [],
          sectors: sectorsR.data || [],
        });
      } catch (e) {
        console.error("Erro ao carregar dados:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [contractId, unit]);

  return { autoData, loading };
}

export function useComputedSummaries(autoData: AutoDataPayload, month: number, year: number) {
  const ym = `${year}-${String(month).padStart(2, "0")}`;

  const entryMatchesPeriod = (period: string) => {
    if (period.includes("/")) {
      const parts = period.split("/");
      if (parts.length === 3) return parts[2] === String(year) && parts[1] === String(month).padStart(2, "0");
      return false;
    }
    return period.startsWith(ym);
  };

  const goalsBySector = useMemo(() => {
    if (!autoData.goals || !autoData.entries) return {};
    const map: Record<string, { name: string; target: number; current: number; pct: number; type: string }[]> = {};
    autoData.goals.forEach((g: any) => {
      const sector = g.sector || "Sem setor";
      const gEntries = autoData.entries!.filter((e: any) => e.goal_id === g.id && entryMatchesPeriod(e.period));
      const current = gEntries.reduce((s: number, e: any) => s + Number(e.value), 0);
      if (!map[sector]) map[sector] = [];
      map[sector].push({
        name: g.name, target: Number(g.target), current,
        pct: g.target > 0 ? Math.min(100, Math.round((current / Number(g.target)) * 100)) : 0,
        type: g.type,
      });
    });
    return map;
  }, [autoData.goals, autoData.entries, ym]);

  const goalSummary = useMemo(() => {
    const all = Object.values(goalsBySector).flat();
    const atingidas = all.filter(g => g.pct >= 90).length;
    const parciais = all.filter(g => g.pct >= 60 && g.pct < 90).length;
    const criticas = all.filter(g => g.pct < 60).length;
    const avg = all.length ? Math.round(all.reduce((s, g) => s + g.pct, 0) / all.length) : 0;
    return { total: all.length, atingidas, parciais, criticas, avg, all };
  }, [goalsBySector]);

  const actionPlanSummary = useMemo(() => {
    const plans = autoData.actionPlans || [];
    return {
      total: plans.length,
      concluidas: plans.filter((p: any) => p.status_acao === "concluida").length,
      emAndamento: plans.filter((p: any) => p.status_acao === "em_andamento").length,
      naoIniciadas: plans.filter((p: any) => p.status_acao === "nao_iniciada").length,
      canceladas: plans.filter((p: any) => p.status_acao === "cancelada").length,
      vencidos: plans.filter((p: any) => p.prazo && new Date(p.prazo) < new Date() && p.status_acao !== "concluida" && p.status_acao !== "cancelada").length,
      byPriority: {
        critica: plans.filter((p: any) => p.prioridade === "critica").length,
        alta: plans.filter((p: any) => p.prioridade === "alta").length,
        media: plans.filter((p: any) => p.prioridade === "media").length,
        baixa: plans.filter((p: any) => p.prioridade === "baixa").length,
      },
      plans,
    };
  }, [autoData.actionPlans]);

  const sauSummary = useMemo(() => {
    const records = autoData.sauRecords || [];
    return {
      total: records.length,
      elogios: records.filter((r: any) => r.tipo === "elogio").length,
      reclamacoes: records.filter((r: any) => r.tipo === "reclamacao").length,
      sugestoes: records.filter((r: any) => r.tipo === "sugestao").length,
      ouvidoria: records.filter((r: any) => r.tipo === "ouvidoria").length,
      resolvidos: records.filter((r: any) => r.status === "resolvido").length,
    };
  }, [autoData.sauRecords]);

  const bedSummary = useMemo(() => {
    const beds = autoData.beds || [];
    const movements = (autoData.bedMovements || []).filter((m: any) => {
      const d = m.movement_date;
      return d.startsWith(ym);
    });
    const totalOccupied = movements.reduce((s: number, m: any) => s + Number(m.occupied), 0);
    const totalAdmissions = movements.reduce((s: number, m: any) => s + Number(m.admissions), 0);
    const totalDischarges = movements.reduce((s: number, m: any) => s + Number(m.discharges), 0);
    const totalDeaths = movements.reduce((s: number, m: any) => s + Number(m.deaths), 0);
    const totalTransfers = movements.reduce((s: number, m: any) => s + Number(m.transfers), 0);
    return {
      totalInternacao: beds.filter((b: any) => b.category === "internacao").reduce((s: number, b: any) => s + Number(b.quantity), 0),
      totalComplementar: beds.filter((b: any) => b.category === "complementar").reduce((s: number, b: any) => s + Number(b.quantity), 0),
      total: beds.reduce((s: number, b: any) => s + Number(b.quantity), 0),
      breakdown: beds.map((b: any) => ({ specialty: b.specialty, quantity: b.quantity, category: b.category })),
      movements: { totalOccupied, totalAdmissions, totalDischarges, totalDeaths, totalTransfers, count: movements.length },
    };
  }, [autoData.beds, autoData.bedMovements, ym]);

  const rubricaSummary = useMemo(() => {
    const entries = (autoData.rubricaEntries || []).filter((e: any) => entryMatchesPeriod(e.period));
    const byRubrica: Record<string, number> = {};
    entries.forEach((e: any) => {
      byRubrica[e.rubrica_name] = (byRubrica[e.rubrica_name] || 0) + Number(e.value_executed);
    });
    const totalExecuted = Object.values(byRubrica).reduce((s, v) => s + v, 0);
    return { byRubrica, totalExecuted, entries };
  }, [autoData.rubricaEntries, ym]);

  return { goalsBySector, goalSummary, actionPlanSummary, sauSummary, bedSummary, rubricaSummary };
}
