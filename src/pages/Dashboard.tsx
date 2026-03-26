import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import KpiCard from "@/components/KpiCard";
import GoalRow from "@/components/GoalRow";
import GoalModal from "@/components/GoalModal";
import { motion } from "framer-motion";

const PERIODS = [
  { key: "S", label: "Semana" },
  { key: "M", label: "Mês" },
  { key: "Q", label: "Trimestre" },
  { key: "4M", label: "Quadrimestre" },
  { key: "Y", label: "Anual" },
];

const UNITS = ["Todas as unidades", "Hospital Geral", "UPA Norte", "UBS Centro"];

const MOCK_GOALS = [
  { id: "1", name: "Taxa de ocupação de leitos", target: 85, current: 78, unit: "%", type: "QNT" as const, risk: 12400, trend: "down" as const },
  { id: "2", name: "Tempo médio de espera (emergência)", target: 30, current: 42, unit: "min", type: "QNT" as const, risk: 8200, trend: "up" as const },
  { id: "3", name: "Satisfação do paciente (NPS)", target: 75, current: 71, unit: "pts", type: "QNT" as const, risk: 5600, trend: "stable" as const },
  { id: "4", name: "Protocolo de higienização", target: 100, current: 92, unit: "%", type: "QLT" as const, risk: 3100, trend: "up" as const },
  { id: "5", name: "Relatório quadrimestral (RDQA)", target: 1, current: 0, unit: "doc", type: "DOC" as const, risk: 15000, trend: "down" as const },
  { id: "6", name: "Taxa de infecção hospitalar", target: 5, current: 6.2, unit: "%", type: "QNT" as const, risk: 9800, trend: "down" as const },
  { id: "7", name: "Cirurgias eletivas realizadas", target: 120, current: 98, unit: "un", type: "QNT" as const, risk: 7300, trend: "up" as const },
  { id: "8", name: "Comissão de óbitos ativa", target: 1, current: 1, unit: "doc", type: "QLT" as const, risk: 0, trend: "stable" as const },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("4M");
  const [selectedUnit, setSelectedUnit] = useState(UNITS[0]);
  const [selectedGoal, setSelectedGoal] = useState<typeof MOCK_GOALS[0] | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  const totalRisk = MOCK_GOALS.reduce((s, g) => s + g.risk, 0);
  const goalsAtRisk = MOCK_GOALS.filter((g) => g.risk > 0).length;
  const avgAttainment = Math.round(
    MOCK_GOALS.reduce((s, g) => {
      const att = g.type === "DOC" ? (g.current >= g.target ? 100 : 0) : Math.min(100, (g.current / g.target) * 100);
      return s + att;
    }, 0) / MOCK_GOALS.length
  );
  const pendingEvidence = MOCK_GOALS.filter((g) => g.type === "DOC" && g.current < g.target).length;

  const handleGoalClick = (goal: typeof MOCK_GOALS[0]) => {
    setSelectedGoal(goal);
    setGoalModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        periods={PERIODS}
        activePeriod={period}
        onPeriodChange={setPeriod}
        units={UNITS}
        selectedUnit={selectedUnit}
        onUnitChange={setSelectedUnit}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <KpiCard label="R$ em risco" value={`R$ ${(totalRisk / 1000).toFixed(1)}k`} status="critical" subtitle="Contrato vigente" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <KpiCard label="Metas em risco" value={`${goalsAtRisk} de ${MOCK_GOALS.length}`} status="warning" subtitle="Abaixo do pactuado" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <KpiCard label="Atingimento médio" value={`${avgAttainment}%`} status={avgAttainment >= 90 ? "success" : avgAttainment >= 70 ? "warning" : "critical"} subtitle="Todas as metas" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <KpiCard label="Evidências pendentes" value={String(pendingEvidence)} status={pendingEvidence > 0 ? "warning" : "success"} subtitle="Documentos a enviar" />
          </motion.div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <NavCard title="Contratos" description="Gerir contratos, valores e glosas" onClick={() => navigate("/contratos")} />
          <NavCard title="Metas e indicadores" description="Detalhamento e projeções por meta" onClick={() => navigate("/metas")} />
          <NavCard title="Projeção de risco" description="Análise financeira e cenários" onClick={() => navigate("/risco")} />
          <NavCard title="Evidências" description="Upload e validação de documentos" onClick={() => navigate("/evidencias")} />
          <NavCard title="Relatórios" description="Gerar PDF consolidado por período" onClick={() => navigate("/relatorios")} />
          <NavCard title="Administração" description="Usuários, perfis e permissões" onClick={() => navigate("/admin")} />
        </div>

        {/* Goals Table */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-lg border border-border"
        >
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-display font-semibold text-foreground">Metas do período</h2>
            <p className="text-sm text-muted-foreground">
              {PERIODS.find((p) => p.key === period)?.label} — {selectedUnit}
            </p>
          </div>
          <div className="divide-y divide-border">
            {MOCK_GOALS.map((goal, i) => (
              <GoalRow key={goal.id} goal={goal} index={i} onClick={() => handleGoalClick(goal)} />
            ))}
          </div>
        </motion.div>
      </main>

      <GoalModal goal={selectedGoal} open={goalModalOpen} onOpenChange={setGoalModalOpen} />
    </div>
  );
};

const NavCard = ({ title, description, onClick }: { title: string; description: string; onClick: () => void }) => (
  <button onClick={onClick} className="kpi-card text-left cursor-pointer group">
    <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">{title}</h3>
    <p className="text-sm text-muted-foreground mt-1">{description}</p>
  </button>
);

export default Dashboard;
