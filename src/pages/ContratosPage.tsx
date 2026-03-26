import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Trash2 } from "lucide-react";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import ContractModal from "@/components/ContractModal";
import ContractFormModal, { ContractData } from "@/components/ContractFormModal";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const INITIAL_CONTRACTS: ContractData[] = [
  { id: "1", name: "Contrato de Gestão — Hospital Geral", value: 12000000, variable: 0.10, goals: 8, status: "Vigente", period: "2024-2025", unit: "Hospital Geral" },
  { id: "2", name: "Contrato de Gestão — UPA Norte", value: 4500000, variable: 0.08, goals: 6, status: "Vigente", period: "2024-2025", unit: "UPA Norte" },
  { id: "3", name: "Contrato de Gestão — UBS Centro", value: 2800000, variable: 0.10, goals: 5, status: "Em renovação", period: "2023-2024", unit: "UBS Centro" },
];

const ContratosPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("4M");
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [contracts, setContracts] = useState<ContractData[]>(INITIAL_CONTRACTS);

  const [selectedContract, setSelectedContract] = useState<ContractData | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editContract, setEditContract] = useState<ContractData | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContractData | null>(null);

  const handleView = (contract: ContractData) => { setSelectedContract(contract); setViewModalOpen(true); };
  const handleNew = () => { setEditContract(null); setIsNew(true); setFormModalOpen(true); };
  const handleEdit = (contract: ContractData) => { setEditContract(contract); setIsNew(false); setFormModalOpen(true); };
  const handleSave = (contract: ContractData) => {
    if (isNew) setContracts((prev) => [...prev, contract]);
    else setContracts((prev) => prev.map((c) => (c.id === contract.id ? contract : c)));
  };
  const handleDelete = () => {
    if (deleteTarget) {
      setContracts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" /> Voltar ao painel
        </button>

        <PageHeader
          title="Contratos de gestão"
          subtitle="Clique para ver detalhes ou use o botão para cadastrar"
          period={period} onPeriodChange={setPeriod}
          selectedUnit={selectedUnit} onUnitChange={setSelectedUnit}
          action={<Button onClick={handleNew}>Novo contrato</Button>}
        />

        <div className="space-y-4">
          {contracts.map((contract, i) => (
            <motion.div key={contract.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="kpi-card">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="cursor-pointer flex-1" onClick={() => handleView(contract)}>
                  <h3 className="font-display font-semibold text-foreground">{contract.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">Vigência: {contract.period} — {contract.goals} metas vinculadas</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`status-badge ${contract.status === "Vigente" ? "status-success" : "status-warning"}`}>{contract.status}</span>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(contract); }}>Editar</Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={(e) => { e.stopPropagation(); setDeleteTarget(contract); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border cursor-pointer" onClick={() => handleView(contract)}>
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

      <ContractModal contract={selectedContract} open={viewModalOpen} onOpenChange={setViewModalOpen} />
      <ContractFormModal contract={editContract} open={formModalOpen} onOpenChange={setFormModalOpen} onSave={handleSave} isNew={isNew} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContratosPage;
