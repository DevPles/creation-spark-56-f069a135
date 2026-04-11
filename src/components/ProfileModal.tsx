import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProfileModal = ({ open, onOpenChange }: ProfileModalProps) => {
  const { user, profile } = useAuth();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile && open) {
      setName(profile.name);
      setPhoto(profile.avatar_url || undefined);
      setCurrentPassword("");
      setNewPassword("");
    }
  }, [profile, open]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 2MB)"); return; }
    if (!["image/jpeg", "image/png"].includes(file.type)) { toast.error("Use JPG ou PNG"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setPhoto(ev.target?.result as string); };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) { toast.error("Preencha o nome"); return; }
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim(), avatar_url: photo || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar perfil", { description: error.message });
      return;
    }
    toast.success("Perfil atualizado");
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Nova senha deve ter no mínimo 6 caracteres");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error("Erro ao alterar senha", { description: error.message });
      return;
    }
    toast.success("Senha alterada com sucesso");
    setCurrentPassword("");
    setNewPassword("");
  };

  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Meu Perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Avatar */}
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
                <span className="text-white text-xs font-medium">Foto</span>
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhotoUpload} />
            <div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Enviar foto</Button>
              <p className="text-[10px] text-muted-foreground mt-1">JPG ou PNG, até 2MB</p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={user?.email || ""} disabled />
            <p className="text-[10px] text-muted-foreground">O e-mail não pode ser alterado.</p>
          </div>

          <Button className="w-full" onClick={handleSaveProfile} disabled={saving}>
            {saving ? "Salvando..." : "Salvar perfil"}
          </Button>

          {/* Password */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <Label className="text-sm font-semibold">Alterar senha</Label>
            <Input
              type="password"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button variant="outline" className="w-full" onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? "Alterando..." : "Alterar senha"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;
