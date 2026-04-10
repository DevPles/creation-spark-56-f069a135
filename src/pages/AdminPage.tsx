import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import UserModal from "@/components/UserModal";
import AdminModal from "@/components/AdminModal";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface User { id: string; name: string; email: string; role: string; unit: string; status: string; photo?: string; visibleCards?: string[]; supervisor_id?: string; supervisorName?: string; }

const ROLE_COLORS: Record<string, string> = {
  Administrador: "status-critical", Gestor: "status-warning", Analista: "status-success", "Clínico": "bg-accent text-accent-foreground",
};

const AdminPage = () => {
  const navigate = useNavigate();
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("list-users");
    if (error) {
      toast.error("Erro ao carregar usuários", { description: error.message });
      setLoading(false);
      return;
    }
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filteredUsers =
    selectedUnit === "Todas as unidades"
      ? users
      : users.filter((user) => user.unit === selectedUnit);

  const handleUserClick = (user: User) => {
    if (user.role === "Administrador") {
      setSelectedUser(user);
      setAdminModalOpen(true);
      return;
    }
    setSelectedUser(user);
    setIsNewUser(false);
    setModalOpen(true);
  };

  const handleNewUser = () => {
    setSelectedUser(null);
    setIsNewUser(true);
    setModalOpen(true);
  };

  const handleSave = async (user: User) => {
    if (user.supervisor_id !== undefined) {
      await supabase
        .from("profiles")
        .update({ supervisor_id: user.supervisor_id || null } as any)
        .eq("id", user.id);
    }
    if (isNewUser) {
      setUsers((prev) => [...prev, user]);
    } else {
      setUsers((prev) => prev.map((currentUser) => currentUser.id === user.id ? user : currentUser));
    }
    fetchUsers();
  };

  const handleAdminSave = (user: User) => {
    setUsers((prev) => prev.map((currentUser) => currentUser.id === user.id ? user : currentUser));
    fetchUsers();
  };

  const activeUsers = filteredUsers.filter((user) => user.status === "Ativo").length;
  const profileCount = new Set(filteredUsers.map((user) => user.role)).size;
  const unitCount = new Set(filteredUsers.map((user) => user.unit)).size;

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          Voltar
        </Button>

        <PageHeader
          title="Administração"
          subtitle="Clique em um usuário para editar ou criar novo"
          selectedUnit={selectedUnit}
          onUnitChange={setSelectedUnit}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAdminModalOpen(true)}>
                Painel Admin
              </Button>
              <Button onClick={handleNewUser}>Novo usuário</Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Total de usuários</p><p className="kpi-value">{filteredUsers.length}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Ativos</p><p className="kpi-value">{activeUsers}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Perfis</p><p className="kpi-value">{profileCount}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Unidades</p><p className="kpi-value">{unitCount}</p></div>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border grid grid-cols-12 text-xs font-medium text-muted-foreground">
            <span className="col-span-3">Nome</span><span className="col-span-3">E-mail</span><span className="col-span-2">Perfil</span><span className="col-span-2">Unidade</span><span className="col-span-2">Status</span>
          </div>
          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Carregando usuários...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado</div>
          ) : (
            filteredUsers.map((user, i) => (
              <motion.div key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} onClick={() => handleUserClick(user)} className="px-5 py-3 grid grid-cols-12 items-center text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="col-span-3 flex items-center gap-2">
                  {user.photo ? (
                    <img src={user.photo} alt={user.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">{user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>
                  )}
                  <span className="font-medium text-foreground truncate">{user.name}</span>
                </div>
                <span className="col-span-3 text-muted-foreground truncate">{user.email}</span>
                <span className="col-span-2"><span className={`status-badge ${ROLE_COLORS[user.role] || ""}`}>{user.role}</span></span>
                <span className="col-span-2 text-muted-foreground">{user.unit}</span>
                <span className="col-span-2"><span className={`status-badge ${user.status === "Ativo" ? "status-success" : "status-warning"}`}>{user.status}</span></span>
              </motion.div>
            ))
          )}
        </div>
      </main>
      <UserModal user={selectedUser} open={modalOpen} onOpenChange={setModalOpen} isNew={isNewUser} onSave={handleSave} />
      <AdminModal user={selectedUser} users={filteredUsers} open={adminModalOpen} onOpenChange={setAdminModalOpen} onSave={handleAdminSave} onSaveOtherUser={handleAdminSave} />
    </div>
  );
};

export default AdminPage;
