import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Shield } from "lucide-react";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import UserModal from "@/components/UserModal";
import AdminModal from "@/components/AdminModal";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface User { id: string; name: string; email: string; role: string; unit: string; status: string; photo?: string; visibleCards?: string[]; }

const INITIAL_USERS: User[] = [
  { id: "1", name: "Ana Silva", email: "ana.silva@hospital.gov.br", role: "Gestor", unit: "Hospital Geral", status: "Ativo" },
  { id: "2", name: "Carlos Mendes", email: "carlos.mendes@hospital.gov.br", role: "Analista", unit: "Hospital Geral", status: "Ativo" },
  { id: "3", name: "Maria Santos", email: "maria.santos@upa.gov.br", role: "Clínico", unit: "UPA Norte", status: "Ativo" },
  { id: "4", name: "João Costa", email: "joao.costa@ubs.gov.br", role: "Clínico", unit: "UBS Centro", status: "Suspenso" },
  { id: "5", name: "Admin Sistema", email: "admin@saude.gov.br", role: "Administrador", unit: "Todas", status: "Ativo" },
];

const ROLE_COLORS: Record<string, string> = {
  Administrador: "status-critical", Gestor: "status-warning", Analista: "status-success", "Clínico": "bg-accent text-accent-foreground",
};

const AdminPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("4M");
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const handleUserClick = (user: User) => {
    if (user.role === "Administrador") {
      setAdminModalOpen(true);
      return;
    }
    setSelectedUser(user);
    setIsNewUser(false);
    setModalOpen(true);
  };
  const handleNewUser = () => { setSelectedUser(null); setIsNewUser(true); setModalOpen(true); };
  const handleSave = (user: User) => {
    if (isNewUser) setUsers(prev => [...prev, user]);
    else setUsers(prev => prev.map(u => u.id === user.id ? user : u));
  };
  const handleAdminSaveUser = (user: User) => {
    setUsers(prev => prev.map(u => u.id === user.id ? user : u));
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <PageHeader
          title="Administração"
          subtitle="Clique em um usuário para editar ou criar novo"
          period={period} onPeriodChange={setPeriod}
          selectedUnit={selectedUnit} onUnitChange={setSelectedUnit}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAdminModalOpen(true)}>
                <Shield className="w-4 h-4 mr-2" /> Painel Admin
              </Button>
              <Button onClick={handleNewUser}>Novo usuário</Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Total de usuários</p><p className="kpi-value">{users.length}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Ativos</p><p className="kpi-value">{users.filter(u => u.status === "Ativo").length}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Perfis</p><p className="kpi-value">4</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Unidades</p><p className="kpi-value">3</p></div>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border grid grid-cols-12 text-xs font-medium text-muted-foreground">
            <span className="col-span-3">Nome</span><span className="col-span-3">E-mail</span><span className="col-span-2">Perfil</span><span className="col-span-2">Unidade</span><span className="col-span-2">Status</span>
          </div>
          {users.map((user, i) => (
            <motion.div key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} onClick={() => handleUserClick(user)} className="px-5 py-3 grid grid-cols-12 items-center text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="col-span-3 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">{user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                <span className="font-medium text-foreground truncate">{user.name}</span>
              </div>
              <span className="col-span-3 text-muted-foreground truncate">{user.email}</span>
              <span className="col-span-2"><span className={`status-badge ${ROLE_COLORS[user.role] || ""}`}>{user.role}</span></span>
              <span className="col-span-2 text-muted-foreground">{user.unit}</span>
              <span className="col-span-2"><span className={`status-badge ${user.status === "Ativo" ? "status-success" : "status-warning"}`}>{user.status}</span></span>
            </motion.div>
          ))}
        </div>
      </main>
      <UserModal user={selectedUser} open={modalOpen} onOpenChange={setModalOpen} isNew={isNewUser} onSave={handleSave} />
      <AdminModal users={users} open={adminModalOpen} onOpenChange={setAdminModalOpen} onSaveUser={handleAdminSaveUser} />
    </div>
  );
};

export default AdminPage;
