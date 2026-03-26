import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import RiskModal from "@/components/RiskModal";
import { motion } from "framer-motion";

const RISK_DATA = [
  { goal: "Relatório RDQA", risk: 15000, prob: 95, trend: "critical", projected: "Não entregue" },
  { goal: "Taxa de ocupação", risk: 12400, prob: 72, trend: "warning", projected: "78% (meta: 85%)" },
  { goal: "Taxa de infecção", risk: 9800, prob: 68, trend: "warning", projected: "6.2% (meta: ≤5%)" },
  { goal: "Tempo de espera", risk: 8200, prob: 60, trend: "warning", projected: "42 min (meta: 30)" },
  { goal: "Cirurgias eletivas", risk: 7300, prob: 55, trend: "warning", projected: "98 (meta: 120)" },
  { goal: "Satisfação NPS", risk: 5600, prob: 45, trend: "warning", projected: "71 (meta: 75)" },
];

const RiscoPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("4M");
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [selectedRisk, setSelectedRisk] = useState<typeof RISK_DATA[0] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const totalRisk = RISK_DATA.reduce((s, r) => s + r.risk, 0);

  const handleClick = (item: typeof RISK_DATA[0]) => { setSelectedRisk(item); setModalOpen(true); };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <PageHeader
          title="Projeção de risco financeiro"
          subtitle="Clique em uma meta para ver cenários e detalhes"
          period={period} onPeriodChange={setPeriod}
          selectedUnit={selectedUnit} onUnitChange={setSelectedUnit}
        />

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="kpi-card mb-6">
          <p className="text-sm text-muted-foreground">Risco total estimado</p>
          <p className="font-display text-3xl font-bold text-risk mt-1">R$ {(totalRisk / 1000).toFixed(1)}k</p>
          <p className="text-xs text-muted-foreground mt-1">Baseado nas projeções atuais para o período</p>
        </motion.div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border grid grid-cols-12 text-xs font-medium text-muted-foreground">
            <span className="col-span-4">Meta</span>
            <span className="col-span-2 text-right">R$ em risco</span>
            <span className="col-span-2 text-right">Prob. perda</span>
            <span className="col-span-4">Projeção</span>
          </div>
          {RISK_DATA.map((item, i) => (
            <motion.div key={item.goal} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} onClick={() => handleClick(item)} className="px-5 py-3 grid grid-cols-12 items-center text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
              <span className="col-span-4 font-medium text-foreground">{item.goal}</span>
              <span className="col-span-2 text-right font-display font-bold text-risk">R$ {(item.risk / 1000).toFixed(1)}k</span>
              <span className="col-span-2 text-right">
                <span className={`status-badge ${item.prob >= 70 ? "status-critical" : "status-warning"}`}>{item.prob}%</span>
              </span>
              <span className="col-span-4 text-muted-foreground">{item.projected}</span>
            </motion.div>
          ))}
        </div>
      </main>
      <RiskModal item={selectedRisk} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
};

export default RiscoPage;
