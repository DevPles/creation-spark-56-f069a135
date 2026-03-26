import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import TopBar from "@/components/TopBar";
import ContractModal from "@/components/ContractModal";
import { motion } from "framer-motion";

const PERIODS = [
  { key: "S", label: "Semana" },
  { key: "M", label: "Mês" },
  { key: "Q", label: "Trimestre" },
  { key: "4M", label: "Quadrimestre" },
  { key: "Y", label: "Anual" },
];
const UNITS = ["Todas as unidades", "Hospital Geral", "UPA Norte", "UBS Centro"];

const CONTRACTS = [
  { id: "1", name: "Contrato de Gestão — Hospital Geral", value: 12000000, variable: 0.10, goals: 8, status: "Vigente", period: "2024-2025" },
  { id: "2", name: "Contrato de Gestão — UPA Norte", value: 4500000, variable: 0.08, goals: 6, status: "Vigente", period: "2024-2025" },
  { id: "3", name: "Contrato de Gestão — UBS Centro", value: 2800000, variable: 0.10, goals: 5, status: "Em renovação", period: "2023-2024" },
];

const ContratosPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("4M");
  const [selectedUnit, setSelectedUnit] = useState(UNITS[0]);
  const [selectedContract, setSelectedContract] = useState<typeof CONTRACTS[0] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = (contract: typeof CONTRACTS[0]) => {
    setSelectedContract(contract);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar periods={PERIODS} activePeriod={period} onPeriodChange={setPeriod} units={UNITS} selectedUnit={selectedUnit} onUnitChange={setSelectedUnit} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" /> Voltar ao painel
        </button>

        <h1 className="font-display text-xl font-bold text-foreground mb-1">Contratos de gestão</h1>
        <p className="text-sm text-muted-foreground mb-6">Clique em um contrato para ver detalhes, metas vinculadas e glosas</p>

        <div className="space-y-4">
          {CONTRACTS.map((contract, i) => (
            <motion.div
              key={contract.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleClick(contract)}
              className="kpi-card cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h3 className="font-display font-semibold text-foreground">{contract.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">Vigência: {contract.period} — {contract.goals} metas vinculadas</p>
                </div>
                <span className={`status-badge ${contract.status === "Vigente" ? "status-success" : "status-warning"}`}>
                  {contract.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Valor total</p>
                  <p className="font-display font-bold text-foreground">R$ {(contract.value / 1000000).toFixed(1)}M</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Parte variável</p>
                  <p className="font-display font-bold text-foreground">{(contract.variable * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">R$ variável</p>
                  <p className="font-display font-bold text-risk">R$ {((contract.value * contract.variable) / 1000).toFixed(0)}k</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <ContractModal contract={selectedContract} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
};

export default ContratosPage;
