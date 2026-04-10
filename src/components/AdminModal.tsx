import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  unit: string;
  status: string;
  photo?: string;
  visibleCards?: string[];
}

interface AdminModalProps {
  user: User | null;
  users: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (user: User) => void;
  onSaveOtherUser: (user: User) => void;
}

const ROLES = ["Administrador", "Gestor", "Analista", "Clínico"];
const UNITS_LIST = ["Hospital Geral", "UPA Norte", "UBS Centro", "Todas"];
const STATUSES = ["Ativo", "Suspenso", "Bloqueado"];

const ALL_CARDS = [
  { id: "contratos", label: "Contratos" },
  { id: "metas", label: "Metas e Indicadores" },
  { id: "risco", label: "Projeção de Risco" },
  { id: "evidencias", label: "Evidências" },
  { id: "relatorios", label: "Relatórios" },
  { id: "admin", label: "Administração" },
  { id: "lancamento", label: "Lançar Metas" },
  { id: "sau", label: "SAU" },
  { id: "relatorio-assistencial", label: "Relatório Assistencial" },
  { id: "controle-rubrica", label: "Controle de Rubrica" },
];

const AdminModal = ({ user, users, open, onOpenChange, onSave, onSaveOtherUser }: AdminModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Administrador");
  const [unit, setUnit] = useState("Todas");
  const [status, setStatus] = useState("Ativo");
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [visibleCards, setVisibleCards] = useState<string[]>(ALL_CARDS.map(c => c.id));
  const [savingPermissions, setSavingPermissions] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  const nonAdminUsers = users.filter(u => u.role !== "Administrador");
  const selectedOtherUser = nonAdminUsers.find(u => u.id === selectedUserId);

  useEffect(() => {
    if (user && open) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setUnit(user.unit);
      setStatus(user.status);
      setPhoto(user.photo);
    }
  }, [user, open]);

  const isValidUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  useEffect(() => {
    if (selectedOtherUser) {
      if (!isValidUuid(selectedOtherUser.id)) {
        setVisibleCards(selectedOtherUser.visibleCards || ALL_CARDS.map(c => c.id));
        return;
      }
      const loadCards = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("allowed_cards")
          .eq("id", selectedOtherUser.id)
          .single();
        if (data && (data as any).allowed_cards) {
          setVisibleCards((data as any).allowed_cards);
        } else {
          setVisibleCards(ALL_CARDS.map(c => c.id));
        }
      };
      loadCards();
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (open) setSelectedUserId("");
  }, [open]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Arquivo muito grande", { description: "Máximo 2MB." }); return; }
    if (!["image/jpeg", "image/png"].includes(file.type)) { toast.error("Formato inválido", { description: "Use JPG ou PNG." }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setPhoto(ev.target?.result as string); toast.success("Foto carregada"); };
    reader.readAsDataURL(file);
  };

  const handleSaveAdmin = () => {
    if (!name || !email) { toast.error("Preencha nome e e-mail"); return; }
    onSave({ id: user?.id || crypto.randomUUID(), name, email, role, unit, status, photo });
    toast.success("Dados do administrador salvos");
  };

  const handleToggleCard = (cardId: string) => {
    setVisibleCards(prev => prev.includes(cardId) ? prev.filter(c => c !== cardId) : [...prev, cardId]);
  };

  const handleSavePermissions = async () => {
    if (!selectedOtherUser) { toast.error("Selecione um usuário"); return; }
    setSavingPermissions(true);
    if (isValidUuid(selectedOtherUser.id)) {
      const { error } = await supabase
        .from("profiles")
        .update({ allowed_cards: visibleCards } as any)
        .eq("id", selectedOtherUser.id);
      if (error) {
        setSavingPermissions(false);
        toast.error("Erro ao salvar permissões", { description: error.message });
        return;
      }
    }
    setSavingPermissions(false);
    onSaveOtherUser({ ...selectedOtherUser, visibleCards });
    toast.success("Permissões atualizadas", { description: `Cards de ${selectedOtherUser.name} salvos.` });
  };

  const handleResetPassword = async () => {
    if (!selectedOtherUser) { toast.error("Selecione um usuário"); return; }
    if (!newPassword || newPassword.length < 6) { toast.error("Digite uma senha com no mínimo 6 caracteres"); return; }
    if (!isValidUuid(selectedOtherUser.id)) {
      toast.success("Senha alterada (local)", { description: `Nova senha definida para ${selectedOtherUser.name}.` });
      setNewPassword("");
      return;
    }
    setResettingPassword(true);
    const { error } = await supabase.functions.invoke("create-admin", {
      body: { action: "reset-password", userId: selectedOtherUser.id, newPassword },
    });
    setResettingPassword(false);
    if (error) {
      toast.error("Erro ao resetar senha", { description: error.message });
      return;
    }
    toast.success("Senha alterada", { description: `Senha de ${selectedOtherUser.name} foi redefinida.` });
    setNewPassword("");
  };

  const initials = name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            Painel do Administrador
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── ADMIN OWN PROFILE ── */}
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="relative w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden group shrink-0 border-2 border-border hover:border-primary transition-colors">
              {photo ? <img src={photo} alt="Avatar" className="w-full h-full object-cover" /> : <span className="text-lg font-semibold text-muted-foreground">{initials}</span>}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-medium">Foto</span>
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhotoUpload} />
            <div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Enviar foto</Button>
              <p className="text-[10px] text-muted-foreground mt-1">JPG ou PNG, até 2MB</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-name">Nome completo</Label>
            <Input id="admin-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">E-mail institucional</Label>
            <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@saude.gov.br" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS_LIST.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <Button className="w-full" onClick={handleSaveAdmin}>Salvar meus dados</Button>

          <Separator />

          {/* ── MANAGE OTHER USERS ── */}
          <div>
            <h3 className="font-display font-semibold text-foreground">Gerenciar usuários</h3>
          </div>

          <div className="space-y-2">
            <Label>Selecionar usuário</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um usuário para gerenciar" />
              </SelectTrigger>
              <SelectContent>
                {nonAdminUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name} — {u.role} ({u.unit})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOtherUser && (
            <>
              <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                <p className="text-sm font-medium text-foreground">{selectedOtherUser.name}</p>
                <p className="text-xs text-muted-foreground">{selectedOtherUser.email}</p>
                <div className="flex gap-2 mt-2">
                  <span className="status-badge bg-accent text-accent-foreground">{selectedOtherUser.role}</span>
                  <span className={`status-badge ${selectedOtherUser.status === "Ativo" ? "status-success" : "status-warning"}`}>{selectedOtherUser.status}</span>
                </div>
              </div>

              <div className="space-y-3 border border-border rounded-lg p-4">
                <Label className="text-sm font-semibold">Cards visíveis para {selectedOtherUser.name}</Label>
                <p className="text-[10px] text-muted-foreground -mt-1">Selecione quais módulos este usuário poderá acessar no dashboard.</p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_CARDS.map(card => (
                    <div key={card.id} className="flex items-center gap-2">
                      <Checkbox id={`admin-card-${card.id}`} checked={visibleCards.includes(card.id)} onCheckedChange={() => handleToggleCard(card.id)} />
                      <label htmlFor={`admin-card-${card.id}`} className="text-sm cursor-pointer text-foreground">{card.label}</label>
                    </div>
                  ))}
                </div>
                <Button className="w-full mt-2" onClick={handleSavePermissions} disabled={savingPermissions}>
                  {savingPermissions ? "Salvando..." : "Salvar permissões"}
                </Button>
              </div>

              <div className="border border-border rounded-lg p-4 space-y-3">
                <Label className="text-sm font-semibold">Segurança</Label>
                <p className="text-[10px] text-muted-foreground -mt-1">Definir nova senha para {selectedOtherUser.name}</p>
                <Input
                  type="password"
                  placeholder="Nova senha (mín. 6 caracteres)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button variant="outline" className="w-full" onClick={handleResetPassword} disabled={resettingPassword}>
                  {resettingPassword ? "Salvando..." : `Redefinir senha de ${selectedOtherUser.name.split(" ")[0]}`}
                </Button>
              </div>
            </>
          )}

          {!selectedOtherUser && selectedUserId === "" && (
            <p className="text-center py-4 text-sm text-muted-foreground">Selecione um usuário acima para gerenciar permissões e segurança.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminModal;
