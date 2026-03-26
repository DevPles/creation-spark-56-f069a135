import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import TopBar from "@/components/TopBar";
import GoalDetailCard from "@/components/GoalDetailCard";
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

const MOCK_GOALS_DETAIL = [
  { id: "1", name: "Taxa de ocupação de leitos", target: 85, current: 78, unit: "%", type: "QNT", risk: 12400, weight: 0.15, trend: "down", scoring: [{ min: 90, label: "Máximo", points: 1 }, { min: 70, label: "Parcial", points: 0.5 }, { min: 0, label: "Insuficiente", points: 0 }], history: [72, 74, 76, 78] },
  { id: "2", name: "Tempo médio de espera", target: 30, current: 42, unit: "min", type: "QNT", risk: 8200, weight: 0.10, trend: "up", scoring: [{ min: 90, label: "Máximo", points: 1 }, { min: 70, label: "Parcial", points: 0.5 }, { min: 0, label: "Insuficiente", points: 0 }], history: [48, 45, 44, 42] },
  { id: "3", name: "Satisfação do paciente (NPS)", target: 75, current: 71, unit: "pts", type: "QNT", risk: 5600, weight: 0.10, trend: "stable", scoring: [{ min: 90, label: "Máximo", points: 1 }, { min: 70, label: "Parcial", points: 0.5 }, { min: 0, label: "Insuficiente", points: 0 }], history: [65, 68, 69, 71] },
  { id: "4", name: "Protocolo de higienização", target: 100, current: 92, unit: "%", type: "QLT", risk: 3100, weight: 0.08, trend: "up", scoring: [{ min: 90, label: "Máximo", points: 1 }, { min: 70, label: "Parcial", points: 0.5 }, { min: 0, label: "Insuficiente", points: 0 }], history: [85, 88, 90, 92] },
  { id: "5", name: "Relatório quadrimestral (RDQA)", target: 1, current: 0, unit: "doc", type: "DOC", risk: 15000, weight: 0.20, trend: "down", scoring: [{ min: 100, label: "Entregue", points: 1 }, { min: 0, label: "Não entregue", points: 0 }], history: [0, 0, 0, 0] },
  { id: "6", name: "Taxa de infecção hospitalar", target: 5, current: 6.2, unit: "%", type: "QNT", risk: 9800, weight: 0.12, trend: "down", scoring: [{ min: 90, label: "Máximo", points: 1 }, { min: 70, label: "Parcial", points: 0.5 }, { min: 0, label: "Insuficiente", points: 0 }], history: [7.1, 6.8, 6.5, 6.2] },
];

const MetasPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("4M");
  const [selectedUnit, setSelectedUnit] = useState(UNITS[0]);
  const [selectedGoal, setSelectedGoal] = useState<typeof MOCK_GOALS_DETAIL[0] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = (goal: typeof MOCK_GOALS_DETAIL[0]) => {
    setSelectedGoal(goal);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar periods={PERIODS} activePeriod={period} onPeriodChange={setPeriod} units={UNITS} selectedUnit={selectedUnit} onUnitChange={setSelectedUnit} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" /> Voltar ao painel
        </button>

        <h1 className="font-display text-xl font-bold text-foreground mb-1">Metas e indicadores</h1>
        <p className="text-sm text-muted-foreground mb-6">Clique em uma meta para ver detalhes completos — {PERIODS.find(p => p.key === period)?.label}</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {MOCK_GOALS_DETAIL.map((goal, i) => (
            <motion.div key={goal.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => handleClick(goal)} className="cursor-pointer">
              <GoalDetailCard goal={goal} />
            </motion.div>
          ))}
        </div>
      </main>

      {selectedGoal && (
        <GoalModal
          goal={{ ...selectedGoal, trend: selectedGoal.trend as "up" | "down" | "stable" }}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      )}
    </div>
  );
};

export default MetasPage;
