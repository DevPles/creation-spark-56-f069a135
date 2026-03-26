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
import { useState, useEffect, useRef } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  unit: string;
  status: string;
  photo?: string;
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

const ALL_CARDS = [
  { id: "metas", label: "Metas" },
  { id: "contratos", label: "Contratos" },
  { id: "riscos", label: "Riscos" },
  { id: "evidencias", label: "Evidências" },
  { id: "relatorios", label: "Relatórios" },
  { id: "admin", label: "Administração" },
];

const UserModal = ({ user, open, onOpenChange, isNew = false, onSave }: UserModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Clínico");
  const [unit, setUnit] = useState("Hospital Geral");
  const [status, setStatus] = useState("Ativo");
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [visibleCards, setVisibleCards] = useState<string[]>(ALL_CARDS.map(c => c.id));
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && !isNew) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setUnit(user.unit);
      setStatus(user.status);
      setPhoto(user.photo);
      setVisibleCards(user.visibleCards || ALL_CARDS.map(c => c.id));
    } else if (isNew) {
      setName("");
      setEmail("");
      setRole("Clínico");
      setUnit("Hospital Geral");
      setStatus("Ativo");
      setPhoto(undefined);
      setVisibleCards(ALL_CARDS.map(c => c.id));
    }
  }, [user, isNew, open]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande", { description: "O tamanho máximo é 2MB." });
      return;
    }
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Formato inválido", { description: "Use JPG ou PNG." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhoto(ev.target?.result as string);
      toast.success("Foto carregada com sucesso");
    };
    reader.readAsDataURL(file);
  };

  const handleToggleCard = (cardId: string) => {
    setVisibleCards(prev =>
      prev.includes(cardId) ? prev.filter(c => c !== cardId) : [...prev, cardId]
    );
  };

  const handleResetPassword = () => {
    toast.success("Senha resetada", {
      description: `Um e-mail de redefinição foi enviado para ${email}.`,
    });
  };

  const handleSave = () => {
    if (!name || !email) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    const data: User = {
      id: user?.id || crypto.randomUUID(),
      name, email, role, unit, status, photo, visibleCards,
    };
    onSave?.(data);
    onOpenChange(false);
    toast.success(isNew ? "Usuário cadastrado" : "Alterações salvas");
  };

  const initials = name
    ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isNew ? "Novo usuário" : "Editar usuário"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Photo upload */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden group shrink-0 border-2 border-border hover:border-primary transition-colors"
            >
              {photo ? (
                <img src={photo} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-semibold text-muted-foreground">{initials}</span>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Enviar foto
              </Button>
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

          {/* Card visibility management */}
          <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/20">
            <Label className="text-sm font-semibold">Cards visíveis para este perfil</Label>
            <p className="text-[10px] text-muted-foreground -mt-1">
              Selecione quais módulos este usuário poderá acessar no dashboard.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CARDS.map((card) => (
                <div key={card.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`card-${card.id}`}
                    checked={visibleCards.includes(card.id)}
                    onCheckedChange={() => handleToggleCard(card.id)}
                  />
                  <label htmlFor={`card-${card.id}`} className="text-sm cursor-pointer text-foreground">
                    {card.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave}>
              {isNew ? "Cadastrar e enviar convite" : "Salvar alterações"}
            </Button>
            {!isNew && (
              <Button variant="outline" onClick={handleResetPassword}>
                <KeyRound className="w-4 h-4 mr-1" />
                Resetar senha
              </Button>
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
