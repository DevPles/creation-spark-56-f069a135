import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  supervisor_id?: string;
}

interface Leader {
  id: string;
  name: string;
  cargo: string | null;
}

interface UserModalProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isNew?: boolean;
  onSave?: (user: User) => void;
}

const ROLES = ["Administrador", "Gestor", "Analista", "Clínico"];
const UNITS_LIST = ["Hospital Geral", "UPA Norte", "UBS Centro"];
const STATUSES = ["Ativo", "Suspenso", "Bloqueado"];

const UserModal = ({ user, open, onOpenChange, isNew = false, onSave }: UserModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Clínico");
  const [unit, setUnit] = useState("Hospital Geral");
  const [status, setStatus] = useState("Ativo");
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [supervisorId, setSupervisorId] = useState<string>("none");
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) fetchLeaders();
  }, [open]);

  useEffect(() => {
    if (user && !isNew) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setUnit(user.unit);
      setStatus(user.status);
      setPhoto(user.photo);
      setSupervisorId(user.supervisor_id || "none");
      setPassword("");
    } else if (isNew) {
      setName(""); setEmail(""); setPassword(""); setRole("Clínico");
      setUnit("Hospital Geral"); setStatus("Ativo"); setPhoto(undefined);
      setSupervisorId("none");
    }
  }, [user, isNew, open]);

  const fetchLeaders = async () => {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["gestor", "admin"] as any);

    if (roleData && roleData.length > 0) {
      const leaderIds = roleData.map((r) => r.user_id);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, name, cargo")
        .in("id", leaderIds);

      if (profileData) {
        const leaderList: Leader[] = profileData.map((p) => {
          const userRole = roleData.find((r) => r.user_id === p.id);
          return {
            id: p.id,
            name: p.name,
            cargo: p.cargo || (userRole?.role === "admin" ? "Administrador" : "Gestor"),
          };
        });
        setLeaders(leaderList);
      }
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Arquivo muito grande", { description: "Maximo 2MB." }); return; }
    if (!["image/jpeg", "image/png"].includes(file.type)) { toast.error("Formato invalido", { description: "Use JPG ou PNG." }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setPhoto(ev.target?.result as string); toast.success("Foto carregada"); };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name || !email) { toast.error("Preencha nome e e-mail"); return; }

    setSaving(true);

    if (isNew) {
      // Create real user via edge function
      if (!password || password.length < 6) {
        toast.error("Defina uma senha com no minimo 6 caracteres");
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-admin", {
        body: { email, password, name, facility_unit: unit, role },
      });

      if (error || data?.error) {
        toast.error("Erro ao criar usuario", { description: data?.error || error?.message });
        setSaving(false);
        return;
      }

      const newUser: User = {
        id: data.user_id,
        name, email, role, unit, status, photo,
        supervisor_id: supervisorId === "none" ? undefined : supervisorId,
      };

      // Update profile with supervisor if needed
      if (supervisorId !== "none") {
        await supabase.functions.invoke("create-admin", {
          body: { action: "update-profile", userId: data.user_id, updates: { supervisor_id: supervisorId } },
        });
      }

      onSave?.(newUser);
      onOpenChange(false);
      toast.success("Usuario criado com sucesso");
    } else {
      // Update existing user
      const userData: User = {
        id: user?.id || "",
        name, email, role, unit, status, photo,
        supervisor_id: supervisorId === "none" ? undefined : supervisorId,
      };

      // Update profile via edge function (bypasses RLS)
      if (user?.id) {
        await supabase.functions.invoke("create-admin", {
          body: {
            action: "update-profile",
            userId: user.id,
            updates: {
              name,
              facility_unit: unit,
              supervisor_id: supervisorId === "none" ? null : supervisorId,
            },
          },
        });
      }

      onSave?.(userData);
      onOpenChange(false);
      toast.success("Alteracoes salvas");
    }

    setSaving(false);
  };

  const initials = name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isNew ? "Novo usuario" : "Editar usuario"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
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
              <p className="text-[10px] text-muted-foreground mt-1">JPG ou PNG, ate 2MB</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-name">Nome completo</Label>
            <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do usuario" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-email">E-mail institucional</Label>
            <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@hospital.gov.br" disabled={!isNew} />
          </div>

          {isNew && (
            <div className="space-y-2">
              <Label htmlFor="user-password">Senha inicial</Label>
              <Input id="user-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 caracteres" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS_LIST.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Chefia / Lider direto</Label>
            <Select value={supervisorId} onValueChange={setSupervisorId}>
              <SelectTrigger><SelectValue placeholder="Selecione o lider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem chefia atribuida</SelectItem>
                {leaders.filter((l) => l.id !== user?.id).map((leader) => (
                  <SelectItem key={leader.id} value={leader.id}>{leader.name} - {leader.cargo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isNew && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : isNew ? "Cadastrar usuario" : "Salvar alteracoes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserModal;
