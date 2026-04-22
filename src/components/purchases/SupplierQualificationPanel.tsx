import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Upload, Trash2, FileText, Eye, ShieldAlert, ShieldCheck, Lock } from "lucide-react";

/**
 * Documentos obrigatórios — Art. 9º (qualificação do fornecedor)
 */
export const REQUIRED_DOCS: { key: string; label: string }[] = [
  { key: "cnpj", label: "I — CNPJ" },
  { key: "inscricao_estadual", label: "II — Inscrição Estadual" },
  { key: "regularidade_fiscal", label: "III — Regularidade fiscal (federal, estadual e municipal)" },
  { key: "contrato_social", label: "IV — Contrato Social ou Estatuto" },
  { key: "autorizacao_funcionamento", label: "V — Autorização de Funcionamento (incl. ANVISA quando exigida)" },
  { key: "fgts", label: "VI — Regularidade perante o FGTS" },
  { key: "cndt", label: "VII — Certidão de Débitos Trabalhistas (CNDT)" },
  { key: "cadin", label: "VIII — Certidão negativa CADIN Estadual e Municipal" },
];

/** Documentos extras quando o fornecedor fornece medicamentos/insumos hospitalares (§1º) */
export const MEDICAMENTOS_DOCS: { key: string; label: string }[] = [
  { key: "med_autorizacao_fabricante", label: "§1º I — Autorização de comercialização do fabricante" },
  { key: "med_responsabilidade_tecnica", label: "§1º II — Certificado de Responsabilidade Técnica (Conselho de Classe)" },
];

export interface SupplierDoc {
  id: string;
  doc_key: string;
  doc_label: string;
  file_url: string;
  file_name: string;
  validade: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

interface Props {
  supplierId: string;
  forneceMedicamentos: boolean;
  inidoneo: boolean;
  qualificacaoStatus: string;
  liberadoMotivo: string | null;
  onChangeForneceMedicamentos: (v: boolean) => void;
  onChangeInidoneo: (v: boolean) => void;
  onStatusRecomputed: (status: string, missingKeys: string[]) => void;
  onAdminLiberar: (motivo: string) => Promise<void>;
  onAdminRevogarLiberacao: () => Promise<void>;
}

export default function SupplierQualificationPanel({
  supplierId, forneceMedicamentos, inidoneo, qualificacaoStatus, liberadoMotivo,
  onChangeForneceMedicamentos, onChangeInidoneo, onStatusRecomputed,
  onAdminLiberar, onAdminRevogarLiberacao,
}: Props) {
  const { profile, isAdmin } = useAuth();
  const [docs, setDocs] = useState<SupplierDoc[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [motivoLiberacao, setMotivoLiberacao] = useState("");
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const allRequired = [...REQUIRED_DOCS, ...(forneceMedicamentos ? MEDICAMENTOS_DOCS : [])];

  const load = async () => {
    const { data } = await supabase.from("supplier_documents").select("*").eq("supplier_id", supplierId);
    const list = (data as SupplierDoc[]) || [];
    setDocs(list);
    const present = new Set(list.map(d => d.doc_key));
    const missing = allRequired.filter(d => !present.has(d.key)).map(d => d.key);
    onStatusRecomputed(missing.length === 0 ? "habilitado" : "pendente", missing);
  };

  useEffect(() => { load(); }, [supplierId, forneceMedicamentos]);

  const handleUpload = async (docKey: string, docLabel: string, file: File | null) => {
    if (!file || !profile) return;
    setUploadingKey(docKey);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${supplierId}/${docKey}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("supplier-documents").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("supplier-documents").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      const fileUrl = signed?.signedUrl || path;

      // upsert (delete existing then insert — table has UNIQUE)
      await supabase.from("supplier_documents").delete().eq("supplier_id", supplierId).eq("doc_key", docKey);
      const { error: insErr } = await supabase.from("supplier_documents").insert({
        supplier_id: supplierId,
        doc_key: docKey,
        doc_label: docLabel,
        file_url: fileUrl,
        file_name: file.name,
        file_size: file.size,
        uploaded_by: profile.id,
        uploaded_by_name: profile.name,
      });
      if (insErr) throw insErr;
      toast.success(`${docLabel} enviado`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar documento");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleRemove = async (doc: SupplierDoc) => {
    if (!confirm(`Remover documento "${doc.doc_label}"?`)) return;
    await supabase.from("supplier_documents").delete().eq("id", doc.id);
    toast.success("Documento removido");
    load();
  };

  const renderDocRow = (def: { key: string; label: string }) => {
    const existing = docs.find(d => d.doc_key === def.key);
    const inputId = `up-${def.key}`;
    return (
      <div key={def.key} className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {existing ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium">{def.label}</div>
            {existing ? (
              <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                <FileText className="h-3 w-3 inline mr-1" />
                {existing.file_name} • enviado por {existing.uploaded_by_name || "—"}
              </div>
            ) : (
              <div className="text-[11px] text-destructive/80 mt-0.5">Pendente</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {existing && (
            <>
              <Button size="sm" variant="outline" className="h-7 rounded-full px-2" onClick={() => window.open(existing.file_url, "_blank")}>
                <Eye className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" className="h-7 rounded-full px-2 text-destructive" onClick={() => handleRemove(existing)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
          <input
            ref={el => (fileInputs.current[def.key] = el)}
            id={inputId}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={e => handleUpload(def.key, def.label, e.target.files?.[0] || null)}
          />
          <Button
            size="sm"
            variant={existing ? "outline" : "default"}
            className="h-7 rounded-full px-3"
            disabled={uploadingKey === def.key}
            onClick={() => fileInputs.current[def.key]?.click()}
          >
            <Upload className="h-3 w-3 mr-1" />
            {uploadingKey === def.key ? "..." : existing ? "Trocar" : "Enviar"}
          </Button>
        </div>
      </div>
    );
  };

  const presentKeys = new Set(docs.map(d => d.doc_key));
  const missingCount = allRequired.filter(d => !presentKeys.has(d.key)).length;

  const statusBadge = inidoneo
    ? <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Inidôneo (vedada contratação)</Badge>
    : qualificacaoStatus === "habilitado"
      ? <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700"><ShieldCheck className="h-3 w-3" /> Habilitado para cotação</Badge>
      : qualificacaoStatus === "liberado_admin"
        ? <Badge className="gap-1 bg-amber-500 hover:bg-amber-600"><Lock className="h-3 w-3" /> Liberação administrativa</Badge>
        : <Badge variant="outline" className="gap-1 border-destructive text-destructive"><AlertCircle className="h-3 w-3" /> Pendente — {missingCount} documento(s) faltando</Badge>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status de qualificação (Art. 9º)</div>
          <div className="mt-1">{statusBadge}</div>
          {qualificacaoStatus === "liberado_admin" && liberadoMotivo && (
            <div className="text-[11px] text-muted-foreground mt-1 max-w-md">Motivo: {liberadoMotivo}</div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={forneceMedicamentos} onCheckedChange={onChangeForneceMedicamentos} id="med-switch" />
            <Label htmlFor="med-switch" className="text-xs cursor-pointer">Fornece medicamentos / insumos hospitalares</Label>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Checkbox checked={inidoneo} onCheckedChange={(v) => onChangeInidoneo(!!v)} id="inidoneo" />
              <Label htmlFor="inidoneo" className="text-xs cursor-pointer text-destructive">Declarado inidôneo</Label>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documentos obrigatórios</div>
        <div className="grid gap-2">
          {REQUIRED_DOCS.map(renderDocRow)}
        </div>
      </div>

      {forneceMedicamentos && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Medicamentos / Insumos hospitalares (§1º)</div>
          <div className="grid gap-2">
            {MEDICAMENTOS_DOCS.map(renderDocRow)}
          </div>
        </div>
      )}

      {/* Liberação administrativa excepcional */}
      {isAdmin && missingCount > 0 && qualificacaoStatus !== "liberado_admin" && !inidoneo && (
        <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 space-y-2">
          <div className="text-xs font-semibold text-amber-900 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Liberação excepcional (somente admin)
          </div>
          <div className="text-[11px] text-amber-800">
            Permite que o fornecedor participe de cotação mesmo com documentação pendente. A justificativa será registrada no dossiê.
          </div>
          <Textarea
            value={motivoLiberacao}
            onChange={e => setMotivoLiberacao(e.target.value)}
            placeholder="Justificativa da liberação (ex.: urgência médica, fornecedor exclusivo em processo de regularização...)"
            rows={2}
            className="text-xs"
          />
          <Button
            size="sm"
            className="rounded-full bg-amber-600 hover:bg-amber-700"
            disabled={!motivoLiberacao.trim()}
            onClick={async () => {
              await onAdminLiberar(motivoLiberacao.trim());
              setMotivoLiberacao("");
            }}
          >
            Liberar fornecedor
          </Button>
        </div>
      )}

      {isAdmin && qualificacaoStatus === "liberado_admin" && (
        <Button size="sm" variant="outline" className="rounded-full" onClick={onAdminRevogarLiberacao}>
          Revogar liberação administrativa
        </Button>
      )}
    </div>
  );
}