import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  unit: string;
  status: string;
}

interface UserModalProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isNew?: boolean;
  onSave?: (user: User) => void;
}

const ROLES = ["Administrador", "Gestor", "Analista", "Clínico"];
const UNITS_LIST = ["Hospital Geral", "UPA Norte", "UBS Centro", "Todas"];
const STATUSES = ["Ativo", "Suspenso", "Bloqueado"];

const UserModal = ({ user, open, onOpenChange, isNew = false, onSave }: UserModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Clínico");
  const [unit, setUnit] = useState("Hospital Geral");
  const [status, setStatus] = useState("Ativo");

  useEffect(() => {
    if (user && !isNew) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setUnit(user.unit);
      setStatus(user.status);
    } else if (isNew) {
      setName("");
      setEmail("");
      setRole("Clínico");
      setUnit("Hospital Geral");
      setStatus("Ativo");
    }
  }, [user, isNew, open]);

  const handleSave = () => {
    const data: User = {
      id: user?.id || crypto.randomUUID(),
      name,
      email,
      role,
      unit,
      status,
    };
    onSave?.(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{isNew ? "Novo usuário" : "Editar usuário"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo upload */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground shrink-0">
              {name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
            </div>
            <div>
              <Button variant="outline" size="sm">Enviar foto</Button>
              <p className="text-[10px] text-muted-foreground mt-1">JPG ou PNG, até 2MB</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-name">Nome completo</Label>
            <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do usuário" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-email">E-mail institucional</Label>
            <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@hospital.gov.br" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS_LIST.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isNew && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave}>
              {isNew ? "Cadastrar e enviar convite" : "Salvar alterações"}
            </Button>
            {!isNew && (
              <Button variant="outline">Resetar senha</Button>
            )}
          </div>

          {isNew && (
            <p className="text-[10px] text-muted-foreground text-center">
              O usuário receberá um e-mail com link para definir sua senha.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserModal;
