import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EntryRow {
  id: string;
  entry_type: string;
  entry_json: Record<string, any>;
  created_at: string;
}

interface Props {
  sectionKey: string;
  reportId: string;
  sectionId: string | null;
  entries: EntryRow[];
  editable: boolean;
  userId: string;
  onRefresh: () => void;
  onEnsureSection: () => Promise<string | null>;
}

const ENTRY_CONFIGS: Record<string, { type: string; label: string; fields: { key: string; label: string; type: "text" | "number" | "date" | "select"; options?: string[] }[] }> = {
  recursos_humanos: {
    type: "rh",
    label: "Quadro de Pessoal",
    fields: [
      { key: "cargo", label: "Cargo / Função", type: "text" },
      { key: "quantidade", label: "Quantidade", type: "number" },
      { key: "turno", label: "Turno", type: "select", options: ["Diurno", "Noturno", "Integral", "12x36", "Outro"] },
      { key: "observacao", label: "Observação", type: "text" },
    ],
  },
  doc_regulatoria: {
    type: "documento",
    label: "Documento Regulatório",
    fields: [
      { key: "nome", label: "Nome do Documento", type: "text" },
      { key: "numero", label: "Número / Referência", type: "text" },
      { key: "emissao", label: "Data de Emissão", type: "date" },
      { key: "validade", label: "Data de Validade", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Vigente", "A vencer", "Vencido", "Pendente", "Em renovação"] },
      { key: "observacao", label: "Observação", type: "text" },
    ],
  },
  doc_operacional: {
    type: "documento_op",
    label: "Documento Operacional",
    fields: [
      { key: "nome", label: "Nome do Documento / POP", type: "text" },
      { key: "numero", label: "Código / Referência", type: "text" },
      { key: "emissao", label: "Data de Emissão", type: "date" },
      { key: "validade", label: "Data de Validade", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Vigente", "A vencer", "Vencido", "Pendente", "Em revisão"] },
      { key: "observacao", label: "Observação", type: "text" },
    ],
  },
  treinamentos: {
    type: "treinamento",
    label: "Treinamento Realizado",
    fields: [
      { key: "nome", label: "Nome do Treinamento", type: "text" },
      { key: "data", label: "Data", type: "date" },
      { key: "publico_alvo", label: "Público-alvo", type: "text" },
      { key: "participantes", label: "Nº Participantes", type: "number" },
      { key: "carga_horaria", label: "Carga Horária (h)", type: "number" },
      { key: "observacao", label: "Observação", type: "text" },
    ],
  },
  seg_trabalho: {
    type: "seguranca",
    label: "Registro de Segurança do Trabalho",
    fields: [
      { key: "tipo", label: "Tipo", type: "select", options: ["Acidente", "Incidente", "Inspeção", "Treinamento NR", "CIPA", "Outro"] },
      { key: "descricao", label: "Descrição", type: "text" },
      { key: "data", label: "Data", type: "date" },
      { key: "providencia", label: "Providência Tomada", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Resolvido", "Em andamento", "Pendente"] },
    ],
  },
  servicos_terceirizados: {
    type: "terceirizado",
    label: "Serviço Terceirizado",
    fields: [
      { key: "fornecedor", label: "Fornecedor / Empresa", type: "text" },
      { key: "escopo", label: "Escopo do Serviço", type: "text" },
      { key: "vigencia", label: "Vigência do Contrato", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Ativo", "Inativo", "Em renovação", "Encerrado"] },
      { key: "conformidade", label: "Conformidade", type: "select", options: ["Conforme", "Não conforme", "Parcial", "A verificar"] },
      { key: "observacao", label: "Observação", type: "text" },
    ],
  },
};

const DOC_STATUS_COLORS: Record<string, string> = {
  "Vigente": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "A vencer": "bg-amber-100 text-amber-800 border-amber-300",
  "Vencido": "bg-red-100 text-red-800 border-red-300",
  "Pendente": "bg-muted text-muted-foreground border-border",
  "Em renovação": "bg-blue-100 text-blue-800 border-blue-300",
  "Em revisão": "bg-blue-100 text-blue-800 border-blue-300",
  "Ativo": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "Inativo": "bg-muted text-muted-foreground border-border",
  "Encerrado": "bg-red-100 text-red-800 border-red-300",
  "Conforme": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "Não conforme": "bg-red-100 text-red-800 border-red-300",
  "Parcial": "bg-amber-100 text-amber-800 border-amber-300",
  "Resolvido": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "Em andamento": "bg-blue-100 text-blue-800 border-blue-300",
};

const SectionEntryForms = ({ sectionKey, reportId, sectionId, entries, editable, userId, onRefresh, onEnsureSection }: Props) => {
  const config = ENTRY_CONFIGS[sectionKey];
  if (!config) return null;

  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      let secId = sectionId;
      if (!secId) {
        secId = await onEnsureSection();
      }
      if (!secId) { toast.error("Erro ao criar seção"); return; }

      await supabase.from("report_section_entries" as any).insert({
        report_id: reportId,
        section_id: secId,
        entry_type: config.type,
        entry_json: formData,
        created_by: userId,
        updated_by: userId,
      });

      setFormData({});
      setFormOpen(false);
      onRefresh();
      toast.success("Registro adicionado");
    } catch { toast.error("Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (entryId: string) => {
    await supabase.from("report_section_entries" as any).delete().eq("id", entryId);
    onRefresh();
    toast.success("Registro removido");
  };

  const sectionEntries = entries.filter(e => e.entry_type === config.type);

  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-foreground">LANÇAMENTO COMPLEMENTAR — {config.label}</p>
          <p className="text-[10px] text-muted-foreground">
            {sectionEntries.length > 0
              ? `${sectionEntries.length} registro(s) lançado(s)`
              : "Nenhum registro. Adicione informações complementares abaixo."}
          </p>
        </div>
        {editable && (
          <Button variant="outline" size="sm" className="text-xs h-7"
            onClick={() => setFormOpen(!formOpen)}>
            {formOpen ? "Cancelar" : "Adicionar"}
          </Button>
        )}
      </div>

      {sectionEntries.length > 0 && (
        <div className="overflow-auto mb-3">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                {config.fields.map(f => (
                  <th key={f.key} className="text-left py-1.5 px-2 text-muted-foreground font-medium">{f.label}</th>
                ))}
                {editable && <th className="text-right py-1.5 px-2 w-16"></th>}
              </tr>
            </thead>
            <tbody>
              {sectionEntries.map(entry => (
                <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20">
                  {config.fields.map(f => {
                    const val = entry.entry_json[f.key] || "—";
                    const statusColor = (f.key === "status" || f.key === "conformidade") ? DOC_STATUS_COLORS[val] : null;
                    return (
                      <td key={f.key} className="py-1.5 px-2">
                        {statusColor ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor}`}>{val}</span>
                        ) : val}
                      </td>
                    );
                  })}
                  {editable && (
                    <td className="py-1.5 px-2 text-right">
                      <Button variant="ghost" size="sm" className="h-5 text-[10px] text-destructive"
                        onClick={() => handleDelete(entry.id)}>Remover</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && editable && (
        <div className="bg-card rounded-lg border border-border p-3 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {config.fields.map(f => (
              <div key={f.key}>
                <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                {f.type === "select" ? (
                  <Select value={formData[f.key] || ""} onValueChange={v => setFormData(p => ({ ...p, [f.key]: v }))}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {f.options?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={formData[f.key] || ""}
                    onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                    className="h-8 text-xs mt-1"
                    placeholder={f.label}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Registro"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectionEntryForms;
