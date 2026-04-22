import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, FileText, Image as ImageIcon, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const STAGES = [
  { value: "solicitante", label: "Solicitante" },
  { value: "auditor_pre", label: "Auditor pré" },
  { value: "almoxarifado", label: "Almoxarifado" },
  { value: "cirurgia", label: "Cirurgia" },
  { value: "auditor_pos", label: "Auditor pós" },
  { value: "faturamento", label: "Faturamento" },
  { value: "incidente", label: "Incidente" },
];

const CATEGORIES = [
  { value: "exame_preop", label: "Exame pré-operatório", required: true, stage: "solicitante" },
  { value: "foto_intraop", label: "Foto intra-operatória", required: false, stage: "cirurgia" },
  { value: "exame_posop", label: "Exame pós-operatório", required: true, stage: "auditor_pos" },
  { value: "nf_fornecedor", label: "Nota fiscal do fornecedor", required: true, stage: "faturamento" },
  { value: "autorizacao_sus", label: "Autorização SUS / convênio", required: false, stage: "auditor_pre" },
  { value: "parecer_auditor", label: "Parecer do auditor", required: false, stage: "auditor_pre" },
  { value: "outro", label: "Outro documento", required: false, stage: "solicitante" },
];

interface Props {
  opmeRequestId: string | null;
}

export default function OpmeAttachmentsTab({ opmeRequestId }: Props) {
  const { user, profile, isAdmin } = useAuth();
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState("solicitante");
  const [category, setCategory] = useState("exame_preop");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    if (!opmeRequestId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("opme_attachments")
      .select("*")
      .eq("opme_request_id", opmeRequestId)
      .order("created_at", { ascending: false });
    if (!error) setAttachments(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [opmeRequestId]);

  const handleUpload = async () => {
    if (!opmeRequestId) { toast.error("Salve a solicitação antes de anexar arquivos"); return; }
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${opmeRequestId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("opme-attachments").upload(path, file);
      if (upErr) throw upErr;
      const cat = CATEGORIES.find(c => c.value === category);
      const { error: insErr } = await supabase.from("opme_attachments").insert({
        opme_request_id: opmeRequestId,
        stage,
        category,
        file_name: file.name,
        file_url: path,
        file_type: file.type,
        file_size: file.size,
        description: description || null,
        is_required: cat?.required || false,
        uploaded_by: user.id,
        uploaded_by_name: profile?.name || null,
      });
      if (insErr) throw insErr;

      // Audit log
      await supabase.from("opme_history").insert({
        opme_request_id: opmeRequestId,
        action: "attachment_added",
        field_changed: category,
        new_value: file.name,
        changed_by: user.id,
        changed_by_name: profile?.name || null,
      });

      toast.success("Anexo enviado");
      setFile(null);
      setDescription("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (att: any) => {
    if (!user) return;
    if (!confirm(`Excluir "${att.file_name}"?`)) return;
    try {
      // file_url stores the storage path directly (private bucket)
      const path = att.file_url.includes("/opme-attachments/")
        ? att.file_url.split("/opme-attachments/")[1]
        : att.file_url;
      if (path) await supabase.storage.from("opme-attachments").remove([path]);
      await supabase.from("opme_attachments").delete().eq("id", att.id);
      await supabase.from("opme_history").insert({
        opme_request_id: opmeRequestId,
        action: "attachment_removed",
        field_changed: att.category,
        old_value: att.file_name,
        changed_by: user.id,
        changed_by_name: profile?.name || null,
      });
      toast.success("Anexo removido");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover");
    }
  };

  const requiredMissing = CATEGORIES
    .filter(c => c.required)
    .filter(c => !attachments.some(a => a.category === c.value));

  const openAttachment = async (att: any) => {
    try {
      const path = att.file_url.includes("/opme-attachments/")
        ? att.file_url.split("/opme-attachments/")[1]
        : att.file_url;
      const { data, error } = await supabase.storage
        .from("opme-attachments")
        .createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) throw error || new Error("URL não gerada");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.message || "Erro ao abrir anexo");
    }
  };

  return (
    <div className="space-y-4">
      {!opmeRequestId && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Salve a solicitação primeiro para anexar arquivos.
          </CardContent>
        </Card>
      )}

      {opmeRequestId && requiredMissing.length > 0 && (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm">
            <strong>Anexos obrigatórios pendentes:</strong>{" "}
            {requiredMissing.map(c => c.label).join(", ")}
          </CardContent>
        </Card>
      )}

      {opmeRequestId && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Etapa do fluxo</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}{c.required ? " *" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Arquivo</Label>
                <Input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: RX de joelho, AP e perfil" />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleUpload} disabled={!file || uploading} className="rounded-full">
                <Upload className="h-4 w-4 mr-1" />
                {uploading ? "Enviando..." : "Enviar anexo"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-4">Carregando...</p>
        ) : attachments.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">Nenhum anexo registrado.</p>
        ) : attachments.map(att => {
          const isImage = att.file_type?.startsWith("image/");
          const stageLabel = STAGES.find(s => s.value === att.stage)?.label || att.stage;
          const catLabel = CATEGORIES.find(c => c.value === att.category)?.label || att.category;
          const canDelete = att.uploaded_by === user?.id || isAdmin;
          return (
            <Card key={att.id}>
              <CardContent className="py-3 flex items-center gap-3">
                <div className="shrink-0">
                  {isImage
                    ? <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    : <FileText className="h-8 w-8 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{att.file_name}</span>
                    <Badge variant="outline" className="text-xs">{stageLabel}</Badge>
                    <Badge variant="secondary" className="text-xs">{catLabel}</Badge>
                    {att.is_required && <Badge className="text-xs">Obrigatório</Badge>}
                  </div>
                  {att.description && <p className="text-xs text-muted-foreground mt-1">{att.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Por {att.uploaded_by_name || "—"} em {new Date(att.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openAttachment(att)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(att)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
