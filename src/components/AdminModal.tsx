import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { KeyRound, Shield } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  unit: string;
  status: string;
  visibleCards?: string[];
}

interface AdminModalProps {
  users: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveUser: (user: User) => void;
}

const ALL_CARDS = [
  { id: "metas", label: "Metas" },
  { id: "contratos", label: "Contratos" },
  { id: "riscos", label: "Riscos" },
  { id: "evidencias", label: "Evidências" },
  { id: "relatorios", label: "Relatórios" },
  { id: "admin", label: "Administração" },
];

const AdminModal = ({ users, open, onOpenChange, onSaveUser }: AdminModalProps) => {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [visibleCards, setVisibleCards] = useState<string[]>(ALL_CARDS.map(c => c.id));

  const nonAdminUsers = users.filter(u => u.role !== "Administrador");
  const selectedUser = nonAdminUsers.find(u => u.id === selectedUserId);

  useEffect(() => {
    if (selectedUser) {
      setVisibleCards(selectedUser.visibleCards || ALL_CARDS.map(c => c.id));
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (open) {
      setSelectedUserId("");
      setVisibleCards(ALL_CARDS.map(c => c.id));
    }
  }, [open]);

  const handleToggleCard = (cardId: string) => {
    setVisibleCards(prev =>
      prev.includes(cardId) ? prev.filter(c => c !== cardId) : [...prev, cardId]
    );
  };

  const handleResetPassword = () => {
    if (!selectedUser) {
      toast.error("Selecione um usuário primeiro");
      return;
    }
    toast.success("Senha resetada", {
      description: `E-mail de redefinição enviado para ${selectedUser.email}.`,
    });
  };

  const handleSaveCards = () => {
    if (!selectedUser) {
      toast.error("Selecione um usuário primeiro");
      return;
    }
    onSaveUser({ ...selectedUser, visibleCards });
    toast.success("Permissões atualizadas", {
      description: `Cards de ${selectedUser.name} foram salvos.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Painel do Administrador
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* User selector */}
          <div className="space-y-2">
            <Label>Selecionar usuário</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um usuário para gerenciar" />
              </SelectTrigger>
              <SelectContent>
                {nonAdminUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} — {u.role} ({u.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && (
            <>
              {/* User info */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                <p className="text-sm font-medium text-foreground">{selectedUser.name}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                <div className="flex gap-2 mt-2">
                  <span className="status-badge bg-accent text-accent-foreground">{selectedUser.role}</span>
                  <span className={`status-badge ${selectedUser.status === "Ativo" ? "status-success" : "status-warning"}`}>{selectedUser.status}</span>
                </div>
              </div>

              {/* Card visibility */}
              <div className="space-y-3 border border-border rounded-lg p-4">
                <Label className="text-sm font-semibold">Cards visíveis para {selectedUser.name}</Label>
                <p className="text-[10px] text-muted-foreground -mt-1">
                  Selecione quais módulos este usuário poderá acessar no dashboard.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_CARDS.map(card => (
                    <div key={card.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`admin-card-${card.id}`}
                        checked={visibleCards.includes(card.id)}
                        onCheckedChange={() => handleToggleCard(card.id)}
                      />
                      <label htmlFor={`admin-card-${card.id}`} className="text-sm cursor-pointer text-foreground">
                        {card.label}
                      </label>
                    </div>
                  ))}
                </div>
                <Button className="w-full mt-2" onClick={handleSaveCards}>
                  Salvar permissões
                </Button>
              </div>

              {/* Password reset */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <Label className="text-sm font-semibold">Segurança</Label>
                <p className="text-[10px] text-muted-foreground -mt-1">
                  Enviar e-mail de redefinição de senha para {selectedUser.email}
                </p>
                <Button variant="outline" className="w-full" onClick={handleResetPassword}>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Resetar senha de {selectedUser.name.split(" ")[0]}
                </Button>
              </div>
            </>
          )}

          {!selectedUser && selectedUserId === "" && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Selecione um usuário acima para gerenciar suas permissões e segurança.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminModal;
