import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import RiskModal from "@/components/RiskModal";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface GoalWithEntries {
  id: string;
  name: string;
  target: number;
  unit: string;
  risk: number;
  facility_unit: string;
  current: number;
}

const RiscoPage = () => {
  const navigate = useNavigate();
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [selectedRisk, setSelectedRisk] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [goals, setGoals] = useState<GoalWithEntries[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const { data: goalsData } = await supabase.from("goals").select("*");
      const { data: entriesData } = await supabase.from("goal_entries").select("*");

      if (!goalsData) return;

      const grouped: Record<string, number> = {};
      (entriesData || []).forEach((e: any) => {
        grouped[e.goal_id] = (grouped[e.goal_id] || 0) + Number(e.value);
      });

      setGoals(goalsData.map((g: any) => ({
        id: g.id,
        name: g.name,
        target: Number(g.target),
        unit: g.unit,
        risk: Number(g.risk),
        facility_unit: g.facility_unit,
        current: grouped[g.id] || 0,
      })));
    };
    loadData();
  }, []);

  const riskData = useMemo(() => {
    return goals
      .filter(g => g.risk > 0)
      .map(g => {
        const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
        const prob = Math.max(0, Math.min(100, Math.round(100 - pct)));
        return {
          goal: g.name,
          risk: g.risk,
          prob,
          trend: prob >= 70 ? "critical" : "warning",
          projected: `${g.current}${g.unit} (meta: ${g.target}${g.unit})`,
          unit: g.facility_unit,
        };
      })
      .sort((a, b) => b.risk - a.risk);
  }, [goals]);

  const filteredRisks =
    selectedUnit === "Todas as unidades"
      ? riskData
      : riskData.filter((item) => item.unit === selectedUnit);

  const totalRisk = filteredRisks.reduce((sum, item) => sum + item.risk, 0);

  const handleClick = (item: any) => {
    setSelectedRisk(item);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          Voltar
        </Button>

        <PageHeader
          title="Projeção de risco financeiro"
          subtitle="Clique em uma meta para ver cenários e detalhes"
          selectedUnit={selectedUnit}
          onUnitChange={setSelectedUnit}
        />

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="kpi-card mb-6">
          <p className="text-sm text-muted-foreground">Risco total estimado</p>
          <p className="font-display text-3xl font-bold text-risk mt-1">R$ {(totalRisk / 1000).toFixed(1)}k</p>
          <p className="text-xs text-muted-foreground mt-1">Baseado nas projeções atuais para o período</p>
        </motion.div>

        {filteredRisks.length === 0 ? (
          <div className="kpi-card p-8 text-center">
            <p className="text-muted-foreground">Nenhuma meta com risco financeiro registrado.</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border grid grid-cols-12 text-xs font-medium text-muted-foreground">
              <span className="col-span-4">Meta</span>
              <span className="col-span-2 text-right">R$ em risco</span>
              <span className="col-span-2 text-right">Prob. perda</span>
              <span className="col-span-4">Projeção</span>
            </div>
            {filteredRisks.map((item, i) => (
              <motion.div
                key={item.goal}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleClick(item)}
                className="px-5 py-3 grid grid-cols-12 items-center text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <span className="col-span-4 font-medium text-foreground">{item.goal}</span>
                <span className="col-span-2 text-right font-display font-bold text-risk">R$ {(item.risk / 1000).toFixed(1)}k</span>
                <span className="col-span-2 text-right">
                  <span className={`status-badge ${item.prob >= 70 ? "status-critical" : "status-warning"}`}>{item.prob}%</span>
                </span>
                <span className="col-span-4 text-muted-foreground">{item.projected}</span>
              </motion.div>
            ))}
          </div>
        )}
      </main>
      <RiskModal item={selectedRisk} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
};

export default RiscoPage;
