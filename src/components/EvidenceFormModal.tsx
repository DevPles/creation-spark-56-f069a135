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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useContracts } from "@/contexts/ContractsContext";

export type EvidenceCategory = "meta" | "rubrica" | "justificativa_interna" | "relatorio_assistencial";

export interface EvidenceData {
  id: string;
  goalName: string;
  type: string;
  fileName: string;
  status: "Pendente" | "Enviada" | "Validada" | "Rejeitada";
  dueDate: string;
  submittedAt?: string;
  notes: string;
  facilityUnit?: string;
  category?: EvidenceCategory;
  activities?: string[];
  module?: string;
  contractId?: string;
  // Action plan fields
  analiseCritica?: string;
  causaRaiz?: string;
  acaoCorretiva?: string;
  responsavel?: string;
  prazoAcao?: string;
  statusAcao?: "Não iniciada" | "Em andamento" | "Concluída";
}

interface EvidenceFormModalProps {
  evidence: EvidenceData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (evidence: EvidenceData) => void;
  isNew?: boolean;
  goalNames?: string[];
}

const EVIDENCE_TYPES = ["PDF", "Planilha", "Ata de reunião", "Relatório", "Checklist", "Pesquisa", "Justificativa Interna", "Outro"];
const STATUSES: EvidenceData["status"][] = ["Pendente", "Enviada", "Validada", "Rejeitada"];

const CATEGORY_OPTIONS: { value: EvidenceCategory; label: string; description: string }[] = [
  { value: "meta", label: "Meta / Indicador", description: "Evidência vinculada a uma meta qualitativa ou quantitativa" },
  { value: "rubrica", label: "Rubrica orçamentária", description: "Justificativa de execução orçamentária" },
  { value: "justificativa_interna", label: "Justificativa interna", description: "Documentação interna para auditoria" },
  { value: "relatorio_assistencial", label: "Relatório assistencial", description: "Usa o contrato de gestão enviado no cadastro do contrato para análise dos pontos relevantes" },
];

const inferCategory = (evidence: EvidenceData | null): EvidenceCategory => {
  if (!evidence) return "meta";
  if (evidence.category) return evidence.category;
  if (evidence.type === "Justificativa Interna" || evidence.goalName?.startsWith("Justificativa:")) return "rubrica";
  return "meta";
};

const EvidenceFormModal = ({ evidence, open, onOpenChange, onSave, isNew = false, goalNames = [] }: EvidenceFormModalProps) => {
  const { contracts } = useContracts();
  const [category, setCategory] = useState<EvidenceCategory>("meta");
  const [goalName, setGoalName] = useState("");
  const [type, setType] = useState("PDF");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<EvidenceData["status"]>("Pendente");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [activities, setActivities] = useState<string[]>([]);
  const [newActivity, setNewActivity] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");

  const contractsWithPdf = contracts.filter(c => c.pdfUrl);

  useEffect(() => {
    if (evidence && !isNew) {
      setCategory(inferCategory(evidence));
      setGoalName(evidence.goalName);
      setType(evidence.type);
      setFileName(evidence.fileName);
      setStatus(evidence.status);
      setDueDate(evidence.dueDate);
      setNotes(evidence.notes);
      setActivities(evidence.activities || []);
      setSelectedContractId(evidence.contractId || "");
    } else if (isNew) {
      setCategory("meta");
      setGoalName(goalNames[0] || "");
      setType("PDF");
      setFileName("");
      setStatus("Pendente");
      setDueDate("");
      setNotes("");
      setActivities([]);
      setSelectedContractId("");
    }
  }, [evidence, isNew, open]);

  const handleAddActivity = () => {
    const trimmed = newActivity.trim();
    if (trimmed && !activities.includes(trimmed)) {
      setActivities((prev) => [...prev, trimmed]);
      setNewActivity("");
    }
  };

  const handleRemoveActivity = (activity: string) => {
    setActivities((prev) => prev.filter((a) => a !== activity));
  };

  const handleSave = () => {
    const data: EvidenceData = {
      id: evidence?.id || crypto.randomUUID(),
      goalName,
      type,
      fileName,
      status,
      dueDate,
      submittedAt: status === "Enviada" || status === "Validada" ? new Date().toLocaleDateString("pt-BR") : undefined,
      notes,
      category,
      activities: activities.length > 0 ? activities : undefined,
      module: category === "relatorio_assistencial" ? "relatorio" : "evidencias",
      contractId: category === "relatorio_assistencial" ? selectedContractId : undefined,
    };
    onSave(data);
    onOpenChange(false);
  };

  const selectedCat = CATEGORY_OPTIONS.find((c) => c.value === category);
  const selectedContract = contracts.find(c => c.id === selectedContractId);

  const referenceLabel = category === "meta" ? "Meta vinculada" : category === "rubrica" ? "Rubrica vinculada" : category === "justificativa_interna" ? "Referência interna" : "Seção do relatório";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isNew ? "Nova evidência" : "Editar evidência"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Category selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</Label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-all ${
                    category === cat.value
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="font-medium text-xs leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
            {selectedCat && (
              <p className="text-[11px] text-muted-foreground">{selectedCat.description}</p>
            )}
          </div>

          {/* Contract selector for relatório assistencial */}
          {category === "relatorio_assistencial" && (
            <div className="space-y-2">
              <Label>Contrato de gestão vinculado</Label>
              <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedContract && selectedContract.pdfUrl && (
                <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
                  <p className="text-xs font-medium text-foreground">PDF do contrato disponível</p>
                  <p className="text-[11px] text-muted-foreground">{selectedContract.pdfName || "Contrato.pdf"}</p>
                  <a
                    href={selectedContract.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline hover:no-underline"
                  >
                    Abrir contrato para análise →
                  </a>
                </div>
              )}
              {selectedContract && !selectedContract.pdfUrl && (
                <p className="text-[11px] text-destructive">Este contrato não possui PDF anexado. Faça upload no cadastro do contrato.</p>
              )}
            </div>
          )}

          {/* Reference field */}
          <div className="space-y-2">
            <Label>{referenceLabel}</Label>
            {category === "meta" && goalNames.length > 0 ? (
              <Select value={goalName} onValueChange={setGoalName}>
                <SelectTrigger><SelectValue placeholder="Selecione a meta" /></SelectTrigger>
                <SelectContent>
                  {goalNames.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder={
                category === "rubrica" ? "Ex: Rubrica de RH — Hospital Geral" :
                category === "justificativa_interna" ? "Ex: Justificativa de aquisição emergencial" :
                category === "relatorio_assistencial" ? "Ex: Seção de indicadores assistenciais" :
                "Nome da meta"
              } />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de evidência</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVIDENCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EvidenceData["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Prazo de entrega</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <Label>Arquivo / Anexo</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              {fileName ? (
                <div>
                  <p className="text-sm text-foreground">{fileName}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setFileName("")}>Remover</Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Arraste ou selecione o arquivo</p>
                  <p className="text-[10px] text-muted-foreground mt-1">PDF, DOC, XLS até 10MB</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setFileName(`evidencia_${Date.now()}.pdf`)}>
                    Selecionar arquivo
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Activities section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              Atividades realizadas
              <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                value={newActivity}
                onChange={(e) => setNewActivity(e.target.value)}
                placeholder="Descreva a atividade..."
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddActivity(); } }}
                className="flex-1"
              />
              <Button type="button" size="sm" variant="outline" onClick={handleAddActivity} disabled={!newActivity.trim()}>
                +
              </Button>
            </div>
            {activities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {activities.map((act, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                    {act}
                    <button type="button" onClick={() => handleRemoveActivity(act)} className="ml-0.5 hover:text-destructive">
                      ✕
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais sobre a evidência..." rows={3} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave}>
              {isNew ? "Enviar evidência" : "Salvar alterações"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EvidenceFormModal;
