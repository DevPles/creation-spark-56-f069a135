import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const PERIODS = [
  { key: "S", label: "Semana" },
  { key: "M", label: "Mês" },
  { key: "Q", label: "Trimestre" },
  { key: "4M", label: "Quadrimestre" },
  { key: "Y", label: "Anual" },
];
const UNITS = ["Todas as unidades", "Hospital Geral", "UPA Norte", "UBS Centro"];

const USERS = [
  { id: "1", name: "Ana Silva", email: "ana.silva@hospital.gov.br", role: "Gestor", unit: "Hospital Geral", status: "Ativo" },
  { id: "2", name: "Carlos Mendes", email: "carlos.mendes@hospital.gov.br", role: "Analista", unit: "Hospital Geral", status: "Ativo" },
  { id: "3", name: "Maria Santos", email: "maria.santos@upa.gov.br", role: "Clínico", unit: "UPA Norte", status: "Ativo" },
  { id: "4", name: "João Costa", email: "joao.costa@ubs.gov.br", role: "Clínico", unit: "UBS Centro", status: "Suspenso" },
  { id: "5", name: "Admin Sistema", email: "admin@saude.gov.br", role: "Administrador", unit: "Todas", status: "Ativo" },
];

const ROLE_COLORS: Record<string, string> = {
  Administrador: "status-critical",
  Gestor: "status-warning",
  Analista: "status-success",
  "Clínico": "bg-accent text-accent-foreground",
};

const AdminPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("4M");
  const [selectedUnit, setSelectedUnit] = useState(UNITS[0]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar periods={PERIODS} activePeriod={period} onPeriodChange={setPeriod} units={UNITS} selectedUnit={selectedUnit} onUnitChange={setSelectedUnit} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" /> Voltar ao painel
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Administração</h1>
            <p className="text-sm text-muted-foreground">Gerenciamento de usuários e permissões</p>
          </div>
          <Button>Novo usuário</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="kpi-card">
            <p className="text-xs text-muted-foreground">Total de usuários</p>
            <p className="kpi-value">{USERS.length}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="kpi-value">{USERS.filter(u => u.status === "Ativo").length}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-muted-foreground">Perfis</p>
            <p className="kpi-value">4</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-muted-foreground">Unidades</p>
            <p className="kpi-value">{UNITS.length - 1}</p>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border grid grid-cols-12 text-xs font-medium text-muted-foreground">
            <span className="col-span-3">Nome</span>
            <span className="col-span-3">E-mail</span>
            <span className="col-span-2">Perfil</span>
            <span className="col-span-2">Unidade</span>
            <span className="col-span-2">Status</span>
          </div>
          {USERS.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="px-5 py-3 grid grid-cols-12 items-center text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <span className="col-span-3 font-medium text-foreground">{user.name}</span>
              <span className="col-span-3 text-muted-foreground">{user.email}</span>
              <span className="col-span-2">
                <span className={`status-badge ${ROLE_COLORS[user.role] || ""}`}>{user.role}</span>
              </span>
              <span className="col-span-2 text-muted-foreground">{user.unit}</span>
              <span className="col-span-2">
                <span className={`status-badge ${user.status === "Ativo" ? "status-success" : "status-warning"}`}>
                  {user.status}
                </span>
              </span>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
