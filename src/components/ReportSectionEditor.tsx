import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
}

interface Props {
  sectionId: string | null;
  sectionKey: string;
  sectionTitle: string;
  sectionDescription: string;
  content: string;
  attachments: Attachment[];
  contractId: string;
  facilityUnit: string;
  period: string;
  sortOrder: number;
  userId: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onAttachmentsChange: () => void;
}

const ReportSectionEditor = ({
  sectionId,
  sectionKey,
  sectionTitle,
  sectionDescription,
  content,
  attachments,
  contractId,
  facilityUnit,
  period,
  sortOrder,
  userId,
  onContentChange,
  onSave,
  onAttachmentsChange,
}: Props) => {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (sectionId) {
        await supabase
          .from("report_sections")
          .update({ content, updated_by: userId })
          .eq("id", sectionId);
      } else {
        await supabase.from("report_sections").insert({
          contract_id: contractId,
          facility_unit: facilityUnit,
          period,
          section_key: sectionKey,
          section_title: sectionTitle,
          content,
          sort_order: sortOrder,
          updated_by: userId,
        });
      }
      onSave();
      toast.success("Seção salva com sucesso");
    } catch {
      toast.error("Erro ao salvar seção");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (files: FileList | null, fileType: string) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      // Ensure section exists first
      let currentSectionId = sectionId;
      if (!currentSectionId) {
        const { data } = await supabase
          .from("report_sections")
          .insert({
            contract_id: contractId,
            facility_unit: facilityUnit,
            period,
            section_key: sectionKey,
            section_title: sectionTitle,
            content,
            sort_order: sortOrder,
            updated_by: userId,
          })
          .select("id")
          .single();
        if (data) currentSectionId = data.id;
        onSave();
      }

      if (!currentSectionId) {
        toast.error("Erro ao criar seção");
        return;
      }

      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${contractId}/${sectionKey}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("report-files")
          .upload(path, file);

        if (uploadError) {
          toast.error(`Erro no upload: ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("report-files")
          .getPublicUrl(path);

        await supabase.from("report_attachments").insert({
          section_id: currentSectionId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: fileType,
          uploaded_by: userId,
          sort_order: attachments.length,
        });
      }

      onAttachmentsChange();
      toast.success("Arquivo(s) enviado(s) com sucesso");
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    await supabase.from("report_attachments").delete().eq("id", attachmentId);
    onAttachmentsChange();
    toast.success("Anexo removido");
  };

  const images = attachments.filter((a) => a.file_type === "image");
  const files = attachments.filter((a) => a.file_type !== "image");

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">{sectionTitle}</h2>
        <p className="text-sm text-muted-foreground mt-1">{sectionDescription}</p>
      </div>

      {/* Content editor */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">Conteúdo da Seção</Label>
        <Textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={`Preencha as informações de "${sectionTitle}"...`}
          rows={12}
          className="font-mono text-sm"
        />
      </div>

      {/* Images */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">Imagens</Label>
        {images.length > 0 && (
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50/80 p-4 mb-3">
            <div className={`flex flex-wrap justify-center gap-3 ${images.length === 1 ? "items-center" : ""}`}>
              {images.map((img) => (
                <div key={img.id} className="relative group rounded-lg overflow-hidden border border-blue-300 shadow-sm bg-white" style={{ maxWidth: images.length === 1 ? "80%" : "48%" }}>
                  <img src={img.file_url} alt={img.file_name} className="w-full object-contain max-h-64" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleDeleteAttachment(img.id)}
                    >
                      Remover
                    </Button>
                  </div>
                  <p className="text-[10px] text-blue-700 p-1 truncate text-center bg-blue-50">{img.file_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files, "image")}
        />
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => imageInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Enviando..." : "+ Inserir imagens"}
        </Button>
      </div>

      {/* Attachments */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">Anexos (PDF, Excel, etc.)</Label>
        {files.length > 0 && (
          <div className="space-y-2 mb-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30 text-sm">
                <a href={file.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex-1">
                  📎 {file.file_name}
                </a>
                <Button variant="ghost" size="sm" className="text-xs text-destructive shrink-0" onClick={() => handleDeleteAttachment(file.id)}>
                  Remover
                </Button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.doc,.docx,.csv"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files, "document")}
        />
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Enviando..." : "+ Inserir anexo"}
        </Button>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-4 border-t border-border">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar Seção"}
        </Button>
      </div>
    </div>
  );
};

export default ReportSectionEditor;
