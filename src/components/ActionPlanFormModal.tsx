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
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { AlertTriangle } from "lucide-react";
import ActionPlanHistoryTimeline from "@/components/ActionPlanHistoryTimeline";

type ActionPlan = Tables<"action_plans">;

interface GoalRisk {
  id: string;
  name: string;
  facility_unit: string;
  risk: number;
  target: number;
  unit: string;
  type: string;
}

interface Props {
  plan: ActionPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  isNew: boolean;
}

const UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];
const CATEGORIES = [
  { value: "meta", label: "Meta / Indicador" },
  { value: "rubrica", label: "Rubrica orçamentária" },
  { value: "justificativa_interna", label: "Justificativa interna" },
  { value: "relatorio_assistencial", label: "Relatório assistencial" },
];
const EVIDENCE_TYPES = ["PDF", "Planilha", "Ata de reunião", "Relatório", "Checklist", "Pesquisa", "Justificativa Interna", "Outro"];
const TIPO_PROBLEMA_OPTIONS = [
  { value: "processo", label: "Processo" },
  { value: "equipamento", label: "Equipamento" },
  { value: "rh", label: "RH" },
  { value: "insumo", label: "Insumo" },
  { value: "infraestrutura", label: "Infraestrutura" },
  { value: "outro", label: "Outro" },
];
const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];
const ACTION_STATUSES = [
  { value: "nao_iniciada", label: "Não iniciada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];
const EVIDENCE_STATUSES = [
  { value: "pendente", label: "Pendente" },
  { value: "enviada", label: "Enviada" },
  { value: "validada", label: "Validada" },
  { value: "rejeitada", label: "Rejeitada" },
];

const ActionPlanFormModal = ({ plan, open, onOpenChange, onSaved, isNew }: Props) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  // Form state
  const [facilityUnit, setFacilityUnit] = useState("Hospital Geral");
  const [category, setCategory] = useState("meta");
  const [referenceName, setReferenceName] = useState("");
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [analiseCritica, setAnaliseCritica] = useState("");
  const [causaRaiz, setCausaRaiz] = useState("");
  const [acaoCorretiva, setAcaoCorretiva] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");
  const [statusAcao, setStatusAcao] = useState("nao_iniciada");
  const [statusEvidencia, setStatusEvidencia] = useState("pendente");
  const [tipoEvidencia, setTipoEvidencia] = useState("PDF");
  const [area, setArea] = useState("");
  const [tipoProblema, setTipoProblema] = useState("outro");
  const [prioridade, setPrioridade] = useState("media");
  const [riscoFinanceiro, setRiscoFinanceiro] = useState("");
  const [notes, setNotes] = useState("");

  // Goals and sectors
  const [goalsAtRisk, setGoalsAtRisk] = useState<GoalRisk[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      const [goalsRes, sectorsRes] = await Promise.all([
        supabase.from("goals").select("id, name, facility_unit, risk, target, unit, type").gt("risk", 0).order("risk", { ascending: false }),
        supabase.from("sectors").select("name, facility_unit"),
      ]);
      if (goalsRes.data) setGoalsAtRisk(goalsRes.data as GoalRisk[]);
      if (sectorsRes.data) {
        const unique = [...new Set(sectorsRes.data.map(s => s.name))].sort();
        setSectors(unique);
      }
    };
    fetchData();
  }, [open]);

  useEffect(() => {
    if (plan && !isNew) {
      setFacilityUnit(plan.facility_unit);
      setCategory(plan.category);
      setReferenceName(plan.reference_name);
      setReferenceId(plan.reference_id);
      setAnaliseCritica(plan.analise_critica || "");
      setCausaRaiz(plan.causa_raiz || "");
      setAcaoCorretiva(plan.acao_corretiva || "");
      setResponsavel(plan.responsavel || "");
      setPrazo(plan.prazo || "");
      setStatusAcao(plan.status_acao);
      setStatusEvidencia(plan.status_evidencia);
      setTipoEvidencia(plan.tipo_evidencia || "PDF");
      setArea(plan.area || "");
      setTipoProblema(plan.tipo_problema);
      setPrioridade(plan.prioridade);
      setRiscoFinanceiro(plan.risco_financeiro?.toString() || "");
      setNotes(plan.notes || "");
    } else if (isNew) {
      setFacilityUnit("Hospital Geral");
      setCategory("meta");
      setReferenceName("");
      setReferenceId(null);
      setAnaliseCritica("");
      setCausaRaiz("");
      setAcaoCorretiva("");
      setResponsavel("");
      setPrazo("");
      setStatusAcao("nao_iniciada");
      setStatusEvidencia("pendente");
      setTipoEvidencia("PDF");
      setArea("");
      setTipoProblema("outro");
      setPrioridade("media");
      setRiscoFinanceiro("");
      setNotes("");
    }
  }, [plan, isNew, open]);

  const filteredGoals = goalsAtRisk.filter(g => g.facility_unit === facilityUnit);
  const selectedGoal = goalsAtRisk.find(g => g.name === referenceName);
  const formatRisk = (risk: number) => risk >= 1000 ? `R$ ${(risk / 1000).toFixed(0)}k` : `R$ ${risk}`;

  const trackHistory = async (planId: string, field: string, oldVal: string | null, newVal: string | null) => {
    if (oldVal === newVal) return;
    await supabase.from("action_plan_history").insert({
      action_plan_id: planId,
      field_changed: field,
      old_value: oldVal,
      new_value: newVal,
      changed_by: user!.id,
    });
  };

  const handleSave = async () => {
    if (!user) return;
    if (!referenceName.trim()) {
      toast.error("Informe a referência do plano de ação");
      return;
    }
    setSaving(true);

    try {
      const payload = {
        facility_unit: facilityUnit,
        category,
        reference_name: referenceName,
        reference_id: referenceId,
        analise_critica: analiseCritica || null,
        causa_raiz: causaRaiz || null,
        acao_corretiva: acaoCorretiva || null,
        responsavel: responsavel || null,
        prazo: prazo || null,
        status_acao: statusAcao as any,
        status_evidencia: statusEvidencia as any,
        tipo_evidencia: tipoEvidencia || null,
        area: area || null,
        tipo_problema: tipoProblema as any,
        prioridade: prioridade as any,
        risco_financeiro: riscoFinanceiro ? parseFloat(riscoFinanceiro) : 0,
        notes: notes || null,
      };

      if (isNew) {
        const { data, error } = await supabase.from("action_plans").insert({ ...payload, created_by: user.id }).select().single();
        if (error) throw error;
        // Track creation
        await supabase.from("action_plan_history").insert({
          action_plan_id: data.id,
          field_changed: "created",
          old_value: null,
          new_value: "Plano criado",
          changed_by: user.id,
        });
        toast.success("Plano de ação criado");
      } else if (plan) {
        // Track changes
        const fields: [string, string | null, string | null][] = [
          ["status_acao", plan.status_acao, statusAcao],
          ["status_evidencia", plan.status_evidencia, statusEvidencia],
          ["prioridade", plan.prioridade, prioridade],
          ["responsavel", plan.responsavel, responsavel || null],
          ["acao_corretiva", plan.acao_corretiva, acaoCorretiva || null],
          ["causa_raiz", plan.causa_raiz, causaRaiz || null],
          ["prazo", plan.prazo, prazo || null],
          ["tipo_problema", plan.tipo_problema, tipoProblema],
          ["area", plan.area, area || null],
        ];

        const { error } = await supabase.from("action_plans").update(payload).eq("id", plan.id);
        if (error) throw error;

        // Log changed fields
        for (const [field, oldVal, newVal] of fields) {
          await trackHistory(plan.id, field, oldVal, newVal);
        }
        toast.success("Plano de ação atualizado");
      }

      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar: " + (e.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            {isNew ? "Novo Plano de Ação" : "Editar Plano de Ação"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Categoria</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                  className={`px-2 py-1.5 rounded-md border text-[11px] font-medium transition-all ${category === cat.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Unit + Tipo problema + Prioridade */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Unidade</Label>
              <Select value={facilityUnit} onValueChange={v => { setFacilityUnit(v); setReferenceName(""); setReferenceId(null); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de problema</Label>
              <Select value={tipoProblema} onValueChange={setTipoProblema}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPO_PROBLEMA_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADE_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Area / Setor */}
          <div className="space-y-1.5">
            <Label className="text-xs">Área / Setor</Label>
            {sectors.length > 0 ? (
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a área" /></SelectTrigger>
                <SelectContent>
                  {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input className="h-9" value={area} onChange={e => setArea(e.target.value)} placeholder="Ex: Farmácia, Nutrição..." />
            )}
          </div>

          {/* Reference */}
          <div className="space-y-1.5">
            <Label className="text-xs">{category === "meta" ? "Meta em risco" : "Referência vinculada"}</Label>
            {category === "meta" && filteredGoals.length > 0 ? (
              <Select value={referenceName} onValueChange={v => { setReferenceName(v); const g = goalsAtRisk.find(x => x.name === v); setReferenceId(g?.id || null); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a meta" /></SelectTrigger>
                <SelectContent>
                  {filteredGoals.map(g => (
                    <SelectItem key={g.id} value={g.name}>
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                        {g.name}
                        <span className="text-[10px] text-muted-foreground ml-auto">{formatRisk(g.risk)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input className="h-9" value={referenceName} onChange={e => setReferenceName(e.target.value)} placeholder="Ex: Rubrica de RH, Aquisição emergencial..." />
            )}
          </div>

          {/* Risk scenario */}
          {category === "meta" && selectedGoal && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-semibold text-destructive">Cenário de risco</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div><span className="text-muted-foreground">Meta:</span> <span className="font-medium">{selectedGoal.target}{selectedGoal.unit}</span></div>
                <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{selectedGoal.type}</span></div>
                <div><span className="text-muted-foreground">Impacto:</span> <span className="font-semibold text-destructive">{formatRisk(selectedGoal.risk)}</span></div>
              </div>
            </div>
          )}

          {/* Análise crítica + Causa raiz + Ação corretiva */}
          <div className="space-y-2 border-t border-border pt-3">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Plano de Ação</Label>
            <div className="space-y-1.5">
              <Label className="text-xs">Análise crítica</Label>
              <Textarea value={analiseCritica} onChange={e => setAnaliseCritica(e.target.value)} placeholder="Qual a situação atual?" rows={2} className="text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Causa raiz</Label>
                <Textarea value={causaRaiz} onChange={e => setCausaRaiz(e.target.value)} placeholder="Por que está abaixo?" rows={2} className="text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ação corretiva</Label>
                <Textarea value={acaoCorretiva} onChange={e => setAcaoCorretiva(e.target.value)} placeholder="O que será feito?" rows={2} className="text-xs" />
              </div>
            </div>
          </div>

          {/* Responsável, prazo, status ação */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Responsável</Label>
              <Input className="h-8 text-xs" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prazo</Label>
              <Input className="h-8 text-xs" type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status ação</Label>
              <Select value={statusAcao} onValueChange={setStatusAcao}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{ACTION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Evidência */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo evidência</Label>
              <Select value={tipoEvidencia} onValueChange={setTipoEvidencia}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{EVIDENCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status evidência</Label>
              <Select value={statusEvidencia} onValueChange={setStatusEvidencia}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{EVIDENCE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Risco financeiro (R$)</Label>
              <Input className="h-8 text-xs" type="number" value={riscoFinanceiro} onChange={e => setRiscoFinanceiro(e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionais..." rows={2} className="text-xs" />
          </div>

          {/* History timeline (edit only) */}
          {!isNew && plan && (
            <div className="border-t border-border pt-3 space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Histórico de Alterações</Label>
              <ActionPlanHistoryTimeline actionPlanId={plan.id} />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button className="flex-1 h-9" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : isNew ? "Criar plano de ação" : "Salvar alterações"}
            </Button>
            <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ActionPlanFormModal;
