import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useContracts } from "@/contexts/ContractsContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

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
  analiseCritica?: string;
  causaRaiz?: string;
  acaoCorretiva?: string;
  responsavel?: string;
  prazoAcao?: string;
  statusAcao?: "Não iniciada" | "Em andamento" | "Concluída";
}

interface GoalRisk {
  name: string;
  facility_unit: string;
  risk: number;
  target: number;
  unit: string;
  type: string;
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
const ACTION_STATUSES: EvidenceData["statusAcao"][] = ["Não iniciada", "Em andamento", "Concluída"];
const UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];

const CATEGORY_OPTIONS: { value: EvidenceCategory; label: string }[] = [
  { value: "meta", label: "Meta / Indicador" },
  { value: "rubrica", label: "Rubrica orçamentária" },
  { value: "justificativa_interna", label: "Justificativa interna" },
  { value: "relatorio_assistencial", label: "Relatório assistencial" },
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
  const [facilityUnit, setFacilityUnit] = useState("Hospital Geral");
  const [goalName, setGoalName] = useState("");
  const [type, setType] = useState("PDF");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<EvidenceData["status"]>("Pendente");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [activities, setActivities] = useState<string[]>([]);
  const [newActivity, setNewActivity] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [analiseCritica, setAnaliseCritica] = useState("");
  const [causaRaiz, setCausaRaiz] = useState("");
  const [acaoCorretiva, setAcaoCorretiva] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prazoAcao, setPrazoAcao] = useState("");
  const [statusAcao, setStatusAcao] = useState<EvidenceData["statusAcao"]>("Não iniciada");

  const [goalsAtRisk, setGoalsAtRisk] = useState<GoalRisk[]>([]);

  // Fetch goals with risk from DB
  useEffect(() => {
    if (!open) return;
    const fetchGoals = async () => {
      const { data } = await supabase
        .from("goals")
        .select("name, facility_unit, risk, target, unit, type")
        .gt("risk", 0)
        .order("risk", { ascending: false });
      if (data) setGoalsAtRisk(data as GoalRisk[]);
    };
    fetchGoals();
  }, [open]);

  const filteredGoals = goalsAtRisk.filter(g => g.facility_unit === facilityUnit);
  const selectedGoalData = goalsAtRisk.find(g => g.name === goalName);

  useEffect(() => {
    if (evidence && !isNew) {
      setCategory(inferCategory(evidence));
      setFacilityUnit(evidence.facilityUnit || "Hospital Geral");
      setGoalName(evidence.goalName);
      setType(evidence.type);
      setFileName(evidence.fileName);
      setStatus(evidence.status);
      setDueDate(evidence.dueDate);
      setNotes(evidence.notes);
      setActivities(evidence.activities || []);
      setSelectedContractId(evidence.contractId || "");
      setAnaliseCritica(evidence.analiseCritica || "");
      setCausaRaiz(evidence.causaRaiz || "");
      setAcaoCorretiva(evidence.acaoCorretiva || "");
      setResponsavel(evidence.responsavel || "");
      setPrazoAcao(evidence.prazoAcao || "");
      setStatusAcao(evidence.statusAcao || "Não iniciada");
    } else if (isNew) {
      setCategory("meta");
      setFacilityUnit("Hospital Geral");
      setGoalName("");
      setType("PDF");
      setFileName("");
      setStatus("Pendente");
      setDueDate("");
      setNotes("");
      setActivities([]);
      setSelectedContractId("");
      setAnaliseCritica("");
      setCausaRaiz("");
      setAcaoCorretiva("");
      setResponsavel("");
      setPrazoAcao("");
      setStatusAcao("Não iniciada");
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
      facilityUnit,
      category,
      activities: activities.length > 0 ? activities : undefined,
      module: category === "relatorio_assistencial" ? "relatorio" : "evidencias",
      contractId: category === "relatorio_assistencial" ? selectedContractId : undefined,
      analiseCritica: analiseCritica || undefined,
      causaRaiz: causaRaiz || undefined,
      acaoCorretiva: acaoCorretiva || undefined,
      responsavel: responsavel || undefined,
      prazoAcao: prazoAcao || undefined,
      statusAcao,
    };
    onSave(data);
    onOpenChange(false);
  };

  const selectedContract = contracts.find(c => c.id === selectedContractId);

  const referenceLabel = category === "meta" ? "Meta em risco" : category === "rubrica" ? "Rubrica vinculada" : category === "justificativa_interna" ? "Referência interna" : "Seção do relatório";

  const formatRisk = (risk: number) => risk >= 1000 ? `R$ ${(risk / 1000).toFixed(0)}k` : `R$ ${risk}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            {isNew ? "Novo Plano de Ação" : "Editar Plano de Ação"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Category selector - compact */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Categoria</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`px-2 py-1.5 rounded-md border text-[11px] font-medium transition-all ${
                    category === cat.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Unit selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Unidade</Label>
            <Select value={facilityUnit} onValueChange={(v) => { setFacilityUnit(v); setGoalName(""); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Contract selector for relatório assistencial */}
          {category === "relatorio_assistencial" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Contrato de gestão</Label>
              <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedContract?.pdfUrl && (
                <a href={selectedContract.pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-primary underline hover:no-underline">
                  Abrir contrato para análise →
                </a>
              )}
            </div>
          )}

          {/* Reference field - goals at risk */}
          <div className="space-y-1.5">
            <Label className="text-xs">{referenceLabel}</Label>
            {category === "meta" && filteredGoals.length > 0 ? (
              <Select value={goalName} onValueChange={setGoalName}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a meta em risco" /></SelectTrigger>
                <SelectContent>
                  {filteredGoals.map((g) => (
                    <SelectItem key={g.name} value={g.name}>
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                        {g.name}
                        <span className="text-[10px] text-muted-foreground ml-auto">{formatRisk(g.risk)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : category === "meta" && filteredGoals.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-2">Nenhuma meta em risco para {facilityUnit}</p>
            ) : (
              <Input className="h-9" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder={
                category === "rubrica" ? "Ex: Rubrica de RH" :
                category === "justificativa_interna" ? "Ex: Aquisição emergencial" :
                "Ex: Seção de indicadores"
              } />
            )}
          </div>

          {/* Scenario card when goal selected */}
          {category === "meta" && selectedGoalData && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-semibold text-destructive">Cenário de risco</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Meta:</span>{" "}
                  <span className="font-medium text-foreground">{selectedGoalData.target}{selectedGoalData.unit}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>{" "}
                  <span className="font-medium text-foreground">{selectedGoalData.type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Impacto:</span>{" "}
                  <span className="font-semibold text-destructive">{formatRisk(selectedGoalData.risk)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo evidência</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVIDENCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EvidenceData["status"])}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prazo</Label>
              <Input className="h-9" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* File upload - compact */}
          <div className="space-y-1.5">
            <Label className="text-xs">Arquivo / Anexo</Label>
            {fileName ? (
              <div className="flex items-center gap-2 text-sm border border-border rounded-md px-3 py-2">
                <span className="flex-1 truncate text-foreground">{fileName}</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setFileName("")}>✕</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setFileName(`evidencia_${Date.now()}.pdf`)}
                className="w-full border-2 border-dashed border-border rounded-md px-3 py-3 text-center hover:border-muted-foreground/40 transition-colors"
              >
                <p className="text-xs text-muted-foreground">Arraste ou clique para selecionar</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">PDF, DOC, XLS até 10MB</p>
              </button>
            )}
          </div>

          {/* Activities - compact */}
          <div className="space-y-1.5">
            <Label className="text-xs">Atividades realizadas <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <div className="flex gap-1.5">
              <Input className="h-8 text-xs flex-1" value={newActivity} onChange={(e) => setNewActivity(e.target.value)} placeholder="Descreva a atividade..."
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddActivity(); } }}
              />
              <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={handleAddActivity} disabled={!newActivity.trim()}>+</Button>
            </div>
            {activities.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {activities.map((act, idx) => (
                  <Badge key={idx} variant="secondary" className="text-[10px] py-0.5 flex items-center gap-0.5 pr-1">
                    {act}
                    <button type="button" onClick={() => handleRemoveActivity(act)} className="hover:text-destructive">✕</button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Action Plan Section */}
          <div className="space-y-2 border-t border-border pt-3">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Plano de Ação</Label>

            <div className="space-y-1.5">
              <Label className="text-xs">Análise crítica</Label>
              <Textarea value={analiseCritica} onChange={(e) => setAnaliseCritica(e.target.value)}
                placeholder={selectedGoalData
                  ? `A meta "${selectedGoalData.name}" apresenta risco de ${formatRisk(selectedGoalData.risk)}. Descreva o cenário atual e o que os dados mostram...`
                  : "Qual a situação atual? O que os dados mostram?"}
                rows={2} className="text-xs" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Causa raiz</Label>
                <Textarea value={causaRaiz} onChange={(e) => setCausaRaiz(e.target.value)} placeholder="Por que está abaixo?" rows={2} className="text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ação corretiva</Label>
                <Textarea value={acaoCorretiva} onChange={(e) => setAcaoCorretiva(e.target.value)} placeholder="O que será feito?" rows={2} className="text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Responsável</Label>
                <Input className="h-8 text-xs" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prazo da ação</Label>
                <Input className="h-8 text-xs" type="date" value={prazoAcao} onChange={(e) => setPrazoAcao(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={statusAcao} onValueChange={(v) => setStatusAcao(v as EvidenceData["statusAcao"])}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTION_STATUSES.map((s) => <SelectItem key={s} value={s!}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais..." rows={2} className="text-xs" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button className="flex-1 h-9" onClick={handleSave}>
              {isNew ? "Criar plano de ação" : "Salvar alterações"}
            </Button>
            <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EvidenceFormModal;