import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import TopBar from "@/components/TopBar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import GoalFormModal from "@/components/GoalFormModal";
import ContractFormModal from "@/components/ContractFormModal";
import EvidenceFormModal from "@/components/EvidenceFormModal";
import PdfExportModal from "@/components/PdfExportModal";
import GoalGauge from "@/components/GoalGauge";
import { GoalData } from "@/components/GoalFormModal";
import { EvidenceData } from "@/components/EvidenceFormModal";
import { ALL_ENTRIES, CONTRACTS, MONTHS, RUBRICA_NAMES } from "@/data/rubricaData";

const UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];

type Step =
  | "inicio"
  | "cadastrar"
  | "consultar"
  | "relatorios"
  // Cadastrar sub-steps
  | "cadastrar-meta"
  | "cadastrar-contrato"
  | "cadastrar-evidencia"
  // Lançar sub-steps
  | "lancar-meta-unit"
  | "lancar-meta-select"
  | "lancar-meta-form"
  | "lancar-rubrica-unit"
  | "lancar-rubrica-select"
  | "lancar-rubrica-form"
  // Consultar sub-steps
  | "consultar-metas-unit"
  | "consultar-metas-list"
  | "consultar-contratos"
  | "consultar-rubricas"
  | "consultar-evidencias";

interface WizardCard {
  id: string;
  title: string;
  description: string;
  action: () => void;
}

interface Goal {
  id: string;
  name: string;
  target: number;
  unit: string;
  type: string;
  weight: number;
  risk: number;
  facility_unit: string;
}

const AssistentePage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [step, setStep] = useState<Step>("inicio");
  const [history, setHistory] = useState<Step[]>([]);

  // Selections
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [selectedRubrica, setSelectedRubrica] = useState("");
  const [selectedContract, setSelectedContract] = useState(CONTRACTS[0]?.id || "");
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0] || "");

  // Data
  const [goals, setGoals] = useState<Goal[]>([]);
  const [existingEntries, setExistingEntries] = useState<Record<string, { value: number; period: string }[]>>({});
  const [loading, setLoading] = useState(false);

  // Form
  const [entryValue, setEntryValue] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [entryNotes, setEntryNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Rubrica form
  const [rubricaValue, setRubricaValue] = useState("");
  const [rubricaDate, setRubricaDate] = useState("");
  const [rubricaNotes, setRubricaNotes] = useState("");

  // Modals
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const goTo = (next: Step) => {
    setHistory(prev => [...prev, step]);
    setStep(next);
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setStep(prev);
    } else {
      navigate("/dashboard");
    }
  };

  const resetForm = () => {
    setEntryValue("");
    setEntryDate("");
    setEntryNotes("");
    setRubricaValue("");
    setRubricaDate("");
    setRubricaNotes("");
  };

  // Load goals for unit
  const loadGoals = async (unit: string) => {
    setLoading(true);
    const { data, error } = await supabase.from("goals").select("*").eq("facility_unit", unit as any);
    if (error) { toast.error("Erro ao carregar metas"); setLoading(false); return; }
    const sortedGoals = ((data as Goal[]) || []).sort((a, b) => a.name.localeCompare(b.name));
    setGoals(sortedGoals);
    if (data && user) {
      const { data: entriesData } = await supabase.from("goal_entries").select("*").eq("user_id", user.id);
      const grouped: Record<string, { value: number; period: string }[]> = {};
      (entriesData || []).forEach((e: any) => {
        if (!grouped[e.goal_id]) grouped[e.goal_id] = [];
        grouped[e.goal_id].push({ value: e.value, period: e.period });
      });
      setExistingEntries(grouped);
    }
    setLoading(false);
  };

  // Submit goal entry
  const handleSubmitEntry = async () => {
    if (!user || !selectedGoal) return;
    if (!entryValue || !entryDate) { toast.error("Preencha o valor e a data"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("goal_entries").insert({
      goal_id: selectedGoal.id, user_id: user.id, value: parseFloat(entryValue), period: entryDate, notes: entryNotes || null,
    });
    if (error) { toast.error("Erro ao salvar lançamento"); }
    else {
      toast.success("Lançamento salvo com sucesso!");
      resetForm();
      await loadGoals(selectedUnit);
    }
    setSubmitting(false);
  };

  // Submit rubrica entry
  const handleSubmitRubrica = () => {
    if (!rubricaValue || !rubricaDate) { toast.error("Preencha o valor e a data"); return; }
    const contract = CONTRACTS.find(c => c.id === selectedContract);
    toast.success(`Lançamento de ${selectedRubrica} (${contract?.unit}) salvo`);
    resetForm();
  };

  // Step metadata
  const getStepInfo = () => {
    switch (step) {
      case "inicio": return { title: "O que deseja fazer?", desc: "Selecione uma das opções abaixo para começar.", progress: 20 };
      case "cadastrar": return { title: "Cadastrar / Lançar dados", desc: "Escolha o tipo de registro ou lançamento.", progress: 40 };
      case "consultar": return { title: "Consultar informações", desc: "Acesse rapidamente as informações cadastradas.", progress: 40 };
      case "relatorios": return { title: "Gerar relatórios", desc: "Selecione as opções do relatório.", progress: 100 };
      case "cadastrar-meta": return { title: "Cadastrar nova meta", desc: "Preencha os dados da meta.", progress: 80 };
      case "cadastrar-contrato": return { title: "Cadastrar novo contrato", desc: "Preencha os dados do contrato.", progress: 80 };
      case "cadastrar-evidencia": return { title: "Enviar evidência", desc: "Faça upload de documentos.", progress: 80 };
      case "lancar-meta-unit": return { title: "Lançar meta — Selecione a unidade", desc: "De qual unidade deseja lançar?", progress: 40 };
      case "lancar-meta-select": return { title: `Lançar meta — ${selectedUnit}`, desc: "Selecione a meta que deseja lançar.", progress: 60 };
      case "lancar-meta-form": return { title: `Lançar: ${selectedGoal?.name || ""}`, desc: `Registre o valor realizado para esta meta.`, progress: 80 };
      case "lancar-rubrica-unit": return { title: "Lançar rubrica — Selecione o contrato", desc: "De qual contrato deseja lançar?", progress: 40 };
      case "lancar-rubrica-select": return { title: "Lançar rubrica — Selecione a rubrica", desc: "Qual rubrica deseja lançar?", progress: 60 };
      case "lancar-rubrica-form": return { title: `Lançar: ${selectedRubrica}`, desc: "Registre o valor executado.", progress: 80 };
      case "consultar-metas-unit": return { title: "Consultar metas — Selecione a unidade", desc: "De qual unidade deseja consultar?", progress: 40 };
      case "consultar-metas-list": return { title: `Metas — ${selectedUnit}`, desc: "Metas cadastradas e seus atingimentos.", progress: 80 };
      case "consultar-contratos": return { title: "Contratos", desc: "Contratos vigentes do sistema.", progress: 80 };
      case "consultar-rubricas": return { title: "Rubricas", desc: "Acompanhe a execução orçamentária.", progress: 80 };
      case "consultar-evidencias": return { title: "Evidências", desc: "Documentos enviados e status.", progress: 80 };
      default: return { title: "", desc: "", progress: 0 };
    }
  };

  const stepInfo = getStepInfo();

  const formatCurrency = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
    return `R$ ${v.toFixed(0)}`;
  };

  // Card definitions per step
  const getCards = (): WizardCard[] => {
    switch (step) {
      case "inicio":
        return [
          { id: "cadastrar", title: "Cadastrar / Lançar dados", description: "Registre novas metas, contratos, evidências ou faça lançamentos de metas e rubricas.", action: () => goTo("cadastrar") },
          { id: "consultar", title: "Consultar informações", description: "Visualize metas, contratos, rubricas e evidências já cadastrados.", action: () => goTo("consultar") },
          { id: "relatorios", title: "Gerar relatórios", description: "Crie relatórios em PDF com os dados consolidados.", action: () => setPdfModalOpen(true) },
        ];
      case "cadastrar":
        return [
          { id: "nova-meta", title: "Cadastrar Meta", description: "Crie uma nova meta quantitativa, qualitativa ou documental com faixas de pontuação.", action: () => { setGoalModalOpen(true); } },
          { id: "novo-contrato", title: "Cadastrar Contrato", description: "Registre um novo contrato de gestão com valores, leitos e setores.", action: () => { setContractModalOpen(true); } },
          { id: "nova-evidencia", title: "Enviar Evidência", description: "Faça upload de documentos comprobatórios vinculados a metas ou rubricas.", action: () => { setEvidenceModalOpen(true); } },
          { id: "lancar-meta", title: "Lançar Meta", description: "Selecione uma unidade e meta para registrar o valor realizado.", action: () => goTo("lancar-meta-unit") },
          { id: "lancar-rubrica", title: "Lançar Rubrica", description: "Registre valores executados por rubrica de um contrato.", action: () => goTo("lancar-rubrica-unit") },
        ];
      case "consultar":
        return [
          { id: "ver-metas", title: "Ver Metas", description: "Consulte metas cadastradas com atingimento e histórico de lançamentos.", action: () => goTo("consultar-metas-unit") },
          { id: "ver-contratos", title: "Ver Contratos", description: "Visualize contratos vigentes, valores e status.", action: () => navigate("/contratos") },
          { id: "ver-rubricas", title: "Ver Rubricas e Riscos", description: "Acompanhe execução orçamentária e projeção de risco.", action: () => navigate("/controle-rubrica") },
          { id: "ver-evidencias", title: "Ver Evidências", description: "Consulte documentos enviados e status de validação.", action: () => navigate("/evidencias") },
          { id: "ver-sau", title: "Ver SAU", description: "Acesse o Serviço de Atendimento ao Usuário.", action: () => navigate("/sau") },
          { id: "ver-relatorio-assistencial", title: "Relatório Assistencial", description: "Indicadores e dados assistenciais.", action: () => navigate("/relatorio-assistencial") },
        ];
      case "lancar-meta-unit":
        return UNITS.map(u => ({
          id: u, title: u, description: `Lançar metas da unidade ${u}`,
          action: () => { setSelectedUnit(u); loadGoals(u); goTo("lancar-meta-select"); },
        }));
      case "lancar-rubrica-unit":
        return CONTRACTS.map(c => ({
          id: c.id, title: c.unit, description: `Contrato: ${c.unit}`,
          action: () => { setSelectedContract(c.id); goTo("lancar-rubrica-select"); },
        }));
      default:
        return [];
    }
  };

  const cards = getCards();

  // Templates for modals
  const newGoalTemplate: GoalData = {
    id: "", name: "", target: 0, current: 0, unit: "%", type: "QNT", risk: 0, weight: 1, trend: "stable",
    scoring: [{ min: 0, label: "Insuficiente", points: 0 }, { min: 50, label: "Regular", points: 50 }, { min: 80, label: "Bom", points: 80 }, { min: 100, label: "Ótimo", points: 100 }],
    history: [], glosaPct: 0,
  };

  const newEvidenceTemplate: EvidenceData = {
    id: "", goalName: "", type: "PDF", fileName: "", status: "Pendente", dueDate: new Date().toISOString().split("T")[0], notes: "",
  };

  // Inline renders for special steps
  const renderLancarMetaSelect = () => {
    if (loading) return <p className="text-muted-foreground text-center py-12">Carregando metas...</p>;
    if (goals.length === 0) return <p className="text-muted-foreground text-center py-12">Nenhuma meta cadastrada para {selectedUnit}.</p>;
    return (
      <div className="grid grid-cols-1 gap-3">
        {goals.map((goal, i) => {
          const existing = existingEntries[goal.id] || [];
          const currentVal = existing.reduce((s, e) => s + e.value, 0);
          const attainment = goal.target > 0 ? Math.min(100, Math.round((currentVal / goal.target) * 100)) : 0;
          return (
            <motion.button
              key={goal.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => { setSelectedGoal(goal); resetForm(); goTo("lancar-meta-form"); }}
              className="kpi-card text-left cursor-pointer group p-5 hover:ring-2 hover:ring-primary/30 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors text-sm">{goal.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Meta: {goal.target}{goal.unit} — Peso: {(goal.weight * 100).toFixed(0)}% — {existing.length} lançamento(s)</p>
                </div>
                <div className="ml-4">
                  <GoalGauge percent={attainment} size={60} />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    );
  };

  const renderLancarMetaForm = () => {
    if (!selectedGoal) return null;
    const existing = existingEntries[selectedGoal.id] || [];
    const currentVal = existing.reduce((s, e) => s + e.value, 0);
    const attainment = selectedGoal.target > 0 ? Math.min(100, Math.round((currentVal / selectedGoal.target) * 100)) : 0;
    const remaining = Math.max(0, selectedGoal.target - currentVal);

    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card p-6 max-w-lg mx-auto">
        <h3 className="font-display font-semibold text-foreground mb-1">{selectedGoal.name}</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Meta: {selectedGoal.target}{selectedGoal.unit} — Peso: {(selectedGoal.weight * 100).toFixed(0)}% — Unidade: {selectedUnit}
        </p>

        <div className="flex justify-center mb-4">
          <GoalGauge percent={attainment} size={100} />
        </div>

        <div className="bg-secondary/50 rounded-lg p-2 text-center mb-4">
          <p className="text-xs text-muted-foreground">
            Faltam <span className="font-semibold text-foreground">{remaining.toFixed(1)}{selectedGoal.unit}</span>
          </p>
        </div>

        {existing.length > 0 && (
          <div className="mb-4 p-3 bg-secondary/50 rounded">
            <p className="text-xs text-muted-foreground mb-1">Lançamentos anteriores:</p>
            <div className="flex flex-wrap gap-1">
              {existing.map((e, idx) => (
                <span key={idx} className="text-xs bg-background px-1.5 py-0.5 rounded border border-border">{e.period}: {e.value}{selectedGoal.unit}</span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Valor realizado</label>
              <Input type="number" step="0.01" placeholder={`Ex: ${selectedGoal.target}`} value={entryValue} onChange={e => setEntryValue(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data do lançamento</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !entryDate && "text-muted-foreground")}>
                    {entryDate || "Selecione o dia"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={entryDate ? new Date(entryDate.split("/").reverse().join("-")) : undefined} onSelect={date => { if (date) setEntryDate(format(date, "dd/MM/yyyy")); }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <Textarea placeholder="Observações (opcional)" value={entryNotes} onChange={e => setEntryNotes(e.target.value)} className="min-h-[60px]" />
          <Button className="w-full" disabled={submitting} onClick={handleSubmitEntry}>
            {submitting ? "Salvando..." : "Lançar"}
          </Button>
        </div>
      </motion.div>
    );
  };

  const renderLancarRubricaSelect = () => {
    const contract = CONTRACTS.find(c => c.id === selectedContract);
    if (!contract) return <p className="text-muted-foreground text-center py-12">Contrato não encontrado.</p>;

    return (
      <div className="grid grid-cols-1 gap-3">
        {RUBRICA_NAMES.map((rubName, i) => {
          const existing = ALL_ENTRIES.find(e => e.unit === contract.unit && e.month === selectedMonth && e.rubrica === rubName);
          const allocated = existing?.valorAllocated || 0;
          const executed = existing?.valorExecuted || 0;
          const pct = allocated > 0 ? Math.round((executed / allocated) * 100) : 0;
          return (
            <motion.button
              key={rubName}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => { setSelectedRubrica(rubName); resetForm(); goTo("lancar-rubrica-form"); }}
              className="kpi-card text-left cursor-pointer group p-5 hover:ring-2 hover:ring-primary/30 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors text-sm">{rubName}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Alocado: {formatCurrency(allocated)} — Executado: {formatCurrency(executed)}
                  </p>
                </div>
                <div className="ml-4">
                  <GoalGauge percent={pct} size={60} />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    );
  };

  const renderLancarRubricaForm = () => {
    const contract = CONTRACTS.find(c => c.id === selectedContract);
    if (!contract) return null;
    const existing = ALL_ENTRIES.find(e => e.unit === contract.unit && e.month === selectedMonth && e.rubrica === selectedRubrica);
    const allocated = existing?.valorAllocated || 0;
    const executed = existing?.valorExecuted || 0;
    const pct = allocated > 0 ? Math.round((executed / allocated) * 100) : 0;

    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card p-6 max-w-lg mx-auto">
        <h3 className="font-display font-semibold text-foreground mb-1">{selectedRubrica}</h3>
        <p className="text-xs text-muted-foreground mb-4">Contrato: {contract.unit}</p>

        <div className="flex justify-center mb-4">
          <GoalGauge percent={pct} size={100} />
        </div>

        <div className="bg-secondary/50 rounded-lg p-2 text-center mb-4">
          <p className="text-xs text-muted-foreground">
            Alocado: <span className="font-semibold text-foreground">{formatCurrency(allocated)}</span>
            {" — "}Executado: <span className="font-semibold text-foreground">{formatCurrency(executed)}</span>
            {" — "}Saldo: <span className="font-semibold text-foreground">{formatCurrency(allocated - executed)}</span>
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Mês de referência</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Valor executado</label>
              <Input type="number" step="0.01" placeholder="R$ 0,00" value={rubricaValue} onChange={e => setRubricaValue(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data do lançamento</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !rubricaDate && "text-muted-foreground")}>
                    {rubricaDate || "Selecione o dia"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={rubricaDate ? new Date(rubricaDate.split("/").reverse().join("-")) : undefined} onSelect={date => { if (date) setRubricaDate(format(date, "dd/MM/yyyy")); }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <Textarea placeholder="Observações (opcional)" value={rubricaNotes} onChange={e => setRubricaNotes(e.target.value)} className="min-h-[60px]" />
          <Button className="w-full" onClick={handleSubmitRubrica}>Lançar</Button>
        </div>
      </motion.div>
    );
  };

  const renderConsultarMetasList = () => {
    if (loading) return <p className="text-muted-foreground text-center py-12">Carregando metas...</p>;
    if (goals.length === 0) return <p className="text-muted-foreground text-center py-12">Nenhuma meta cadastrada para {selectedUnit}.</p>;
    return (
      <div className="grid grid-cols-1 gap-3">
        {goals.map((goal, i) => {
          const existing = existingEntries[goal.id] || [];
          const currentVal = existing.reduce((s, e) => s + e.value, 0);
          const attainment = goal.target > 0 ? Math.min(100, Math.round((currentVal / goal.target) * 100)) : 0;
          const remaining = Math.max(0, goal.target - currentVal);
          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="kpi-card p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-display font-semibold text-foreground text-sm">{goal.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Meta: {goal.target}{goal.unit} — Peso: {(goal.weight * 100).toFixed(0)}% — Tipo: {goal.type}
                  </p>
                </div>
                <GoalGauge percent={attainment} size={70} />
              </div>
              <div className="bg-secondary/50 rounded-lg p-2 text-center mb-2">
                <p className="text-xs text-muted-foreground">
                  Realizado: <span className="font-semibold text-foreground">{currentVal.toFixed(1)}{goal.unit}</span>
                  {" — "}Faltam: <span className="font-semibold text-foreground">{remaining.toFixed(1)}{goal.unit}</span>
                </p>
              </div>
              {existing.length > 0 && (
                <div className="p-2 bg-secondary/30 rounded">
                  <p className="text-xs text-muted-foreground mb-1">Lançamentos ({existing.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {existing.map((e, idx) => (
                      <span key={idx} className="text-xs bg-background px-1.5 py-0.5 rounded border border-border">{e.period}: {e.value}{goal.unit}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    );
  };

  // Check if we should render inline content or cards
  const isInlineStep = [
    "lancar-meta-select", "lancar-meta-form",
    "lancar-rubrica-select", "lancar-rubrica-form",
    "consultar-metas-list",
  ].includes(step);

  const renderInlineContent = () => {
    switch (step) {
      case "lancar-meta-select": return renderLancarMetaSelect();
      case "lancar-meta-form": return renderLancarMetaForm();
      case "lancar-rubrica-select": return renderLancarRubricaSelect();
      case "lancar-rubrica-form": return renderLancarRubricaForm();
      case "consultar-metas-list": return renderConsultarMetasList();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" onClick={goBack} className="text-sm">
              Voltar
            </Button>
            <span className="text-xs text-muted-foreground">
              {step === "inicio" ? "Início" : ""}
            </span>
          </div>
          <Progress value={stepInfo.progress} className="h-2" />
        </div>

        {/* Step title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            {stepInfo.title}
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {stepInfo.desc}
          </p>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {isInlineStep ? (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
            >
              {renderInlineContent()}
            </motion.div>
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 gap-4"
            >
              {cards.map((card, i) => (
                <motion.button
                  key={card.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  onClick={card.action}
                  className="kpi-card text-left cursor-pointer group p-6 hover:ring-2 hover:ring-primary/30 transition-all"
                >
                  <h3 className="font-display font-semibold text-lg text-foreground group-hover:text-primary transition-colors mb-1">
                    {card.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <GoalFormModal
        goal={newGoalTemplate}
        open={goalModalOpen}
        onOpenChange={setGoalModalOpen}
        onSave={() => { setGoalModalOpen(false); toast.success("Meta cadastrada!"); }}
        isNew
      />

      <ContractFormModal
        contract={null}
        open={contractModalOpen}
        onOpenChange={setContractModalOpen}
        onSave={() => { setContractModalOpen(false); toast.success("Contrato cadastrado!"); }}
        isNew
      />

      <EvidenceFormModal
        evidence={newEvidenceTemplate}
        open={evidenceModalOpen}
        onOpenChange={setEvidenceModalOpen}
        onSave={() => { setEvidenceModalOpen(false); toast.success("Evidência enviada!"); }}
        isNew
      />

      <PdfExportModal
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
        onGenerate={() => { setPdfModalOpen(false); toast.success("Relatório gerado!"); }}
      />
    </div>
  );
};

export default AssistentePage;
