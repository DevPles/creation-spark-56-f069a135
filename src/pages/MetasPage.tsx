import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import GoalDetailCard from "@/components/GoalDetailCard";
import GoalModal from "@/components/GoalModal";
import GoalFormModal, { GoalData } from "@/components/GoalFormModal";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const INITIAL_GOALS: GoalData[] = [
  { id: "1", name: "Taxa de ocupação de leitos", target: 85, current: 78, unit: "%", type: "QNT", risk: 12400, weight: 0.15, trend: "down", scoring: [{ min: 90, label: "Máximo", points: 1 }, { min: 70, label: "Parcial", points: 0.5 }, { min: 0, label: "Insuficiente", points: 0 }], history: [72, 74, 76, 78], glosaPct: 0.05, facilityUnit: "Hospital Geral" },
  { id: "2", name: "Tempo médio de espera", target: 30, current: 42, unit: "min", type: "QNT", risk: 8200, weight: 0.10, trend: "up", scoring: [{ min: 90, label: "Máximo", points: 1 }, { min: 70, label: "Parcial", points: 0.5 }, { min: 0, label: "Insuficiente", points: 0 }], history: [48, 45, 44, 42], glosaPct: 0.03, facilityUnit: "Hospital Geral" },
  { id: "3", name: "Satisfação do paciente (NPS)", target: 75, current: 71, unit: "pts", type: "QNT", risk: 5600, weight: 0.10, trend: "stable", scoring: [{ min: 90, label: "Máximo", points: 1 }, { min: 70, label: "Parcial", points: 0.5 }, { min: 0, label: "Insuficiente", points: 0 }], history: [65, 68, 69, 71], glosaPct: 0.03, facilityUnit: "UPA Norte" },
  { id: "4", name: "Protocolo de higienização", target: 100, current: 92, unit: "%", type: "QLT", risk: 3100, weight: 0.08, trend: "up", scoring: [{ min: 90, label: "Máximo", points: 1 }, { min: 70, label: "Parcial", points: 0.5 }, { min: 0, label: "Insuficiente", points: 0 }], history: [85, 88, 90, 92], glosaPct: 0.02, facilityUnit: "UPA Norte" },
  { id: "5", name: "Relatório quadrimestral (RDQA)", target: 1, current: 0, unit: "doc", type: "DOC", risk: 15000, weight: 0.20, trend: "down", scoring: [{ min: 100, label: "Entregue", points: 1 }, { min: 0, label: "Não entregue", points: 0 }], history: [0, 0, 0, 0], glosaPct: 0.08, facilityUnit: "UBS Centro" },
  { id: "6", name: "Taxa de infecção hospitalar", target: 5, current: 6.2, unit: "%", type: "QNT", risk: 9800, weight: 0.12, trend: "down", scoring: [{ min: 90, label: "Máximo", points: 1 }, { min: 70, label: "Parcial", points: 0.5 }, { min: 0, label: "Insuficiente", points: 0 }], history: [7.1, 6.8, 6.5, 6.2], glosaPct: 0.04, facilityUnit: "UBS Centro" },
];

const MetasPage = () => {
  const navigate = useNavigate();
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [goals, setGoals] = useState<GoalData[]>(INITIAL_GOALS);
  const [selectedGoal, setSelectedGoal] = useState<GoalData | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<GoalData | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);

  const handleView = (goal: GoalData) => { setSelectedGoal(goal); setViewModalOpen(true); };
  const handleNew = () => { setEditGoal(null); setIsNew(true); setFormModalOpen(true); };
  const handleEdit = (goal: GoalData) => { setEditGoal(goal); setIsNew(false); setFormModalOpen(true); };
  const handleSave = (goal: GoalData) => {
    if (isNew) setGoals((prev) => [...prev, goal]);
    else setGoals((prev) => prev.map((g) => (g.id === goal.id ? goal : g)));
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          ← Voltar
        </Button>

        <PageHeader
          title="Metas e indicadores"
          subtitle="Clique para ver detalhes ou use o botão para cadastrar"
          selectedUnit={selectedUnit}
          onUnitChange={setSelectedUnit}
          action={<Button onClick={handleNew}>Nova meta</Button>}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {goals
            .filter((g) => selectedUnit === "Todas as unidades" || g.facilityUnit === selectedUnit)
            .map((goal, i) => (
            <motion.div key={goal.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="relative group">
                <div className="cursor-pointer" onClick={() => handleView(goal)}>
                  <GoalDetailCard goal={goal} />
                </div>
                <Button variant="outline" size="sm" className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleEdit(goal); }}>
                  Editar
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {selectedGoal && <GoalModal goal={{ ...selectedGoal, trend: selectedGoal.trend }} open={viewModalOpen} onOpenChange={setViewModalOpen} />}
      <GoalFormModal goal={editGoal} open={formModalOpen} onOpenChange={setFormModalOpen} onSave={handleSave} isNew={isNew} />
    </div>
  );
};

export default MetasPage;
