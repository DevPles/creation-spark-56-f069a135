import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import TopBar from "@/components/TopBar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useContracts } from "@/contexts/ContractsContext";
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
import { ALL_ENTRIES, CONTRACTS as RUBRICA_CONTRACTS, MONTHS, RUBRICA_NAMES } from "@/data/rubricaData";

const UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];

type Step =
  | "inicio"
  | "cadastrar"
  | "consultar"
  | "relatorios"
  | "treinamento"
  | "lancar-meta-unit"
  | "lancar-meta-select"
  | "lancar-meta-form"
  | "lancar-rubrica-unit"
  | "lancar-rubrica-select"
  | "lancar-rubrica-form"
  | "consultar-metas-unit"
  | "consultar-metas-list"
  | "enviar-evidencia-contract"
  | "relatorio-select"
  | "finalizado";

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

/* ── Training types ── */
interface TrainingModule {
  id: string;
  title: string;
  description: string;
  video_url: string | null;
  video_uploaded_at: string | null;
  sort_order: number;
  created_by: string | null;
}

interface Rating {
  module_id: string;
  rating: number;
}

interface ProfileContact {
  id: string;
  name: string;
  cargo: string | null;
  facility_unit: string;
}

const REPORT_OPTIONS = [
  { id: "consolidado", title: "Relatório Consolidado", description: "Resumo geral de metas, atingimento e risco financeiro de todas as unidades." },
  { id: "rdqa", title: "RDQA — Relatório Detalhado", description: "Relatório exigido pela LC 141/2012, art. 36, com dados quadrimestrais." },
  { id: "contrato", title: "Relatório por Contrato", description: "Detalhamento financeiro, glosas e execução orçamentária por contrato." },
  { id: "metas", title: "Relatório de Metas", description: "Evolução, projeções e atingimento por indicador." },
  { id: "risco", title: "Análise de Risco", description: "Cenários de glosa e priorização de recuperação de metas." },
  { id: "evidencias", title: "Status de Evidências", description: "Listagem de documentos enviados, pendentes e validados." },
  { id: "assistencial", title: "Relatório Assistencial", description: "Indicadores assistenciais com análise detalhada por unidade." },
  { id: "pdf-export", title: "Exportar PDF Personalizado", description: "Monte um relatório customizado selecionando contratos e seções." },
];

const AssistentePage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { contracts } = useContracts();
  const [step, setStep] = useState<Step>("inicio");
  const [history, setHistory] = useState<Step[]>([]);

  // Selections
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [selectedRubrica, setSelectedRubrica] = useState("");
  const [selectedContract, setSelectedContract] = useState(RUBRICA_CONTRACTS[0]?.id || "");
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0] || "");

  // Goal data
  const [goals, setGoals] = useState<Goal[]>([]);
  const [existingEntries, setExistingEntries] = useState<Record<string, { value: number; period: string }[]>>({});
  const [loading, setLoading] = useState(false);

  // Entry form
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

  // Confirmation data
  const [finalizadoData, setFinalizadoData] = useState<{ title: string; details: string[]; redirectTo?: string }>({ title: "", details: [] });

  // Evidence contract selection
  const [evidenceContractId, setEvidenceContractId] = useState("");

  /* ══ Training state ══ */
  const [trainingModules, setTrainingModules] = useState<TrainingModule[]>([]);
  const [trainingRatings, setTrainingRatings] = useState<Record<string, number>>({});
  const [avgRatings, setAvgRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playModule, setPlayModule] = useState<TrainingModule | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<ProfileContact[]>([]);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [trainingModalMode, setTrainingModalMode] = useState<"create" | "edit">("create");
  const [trainingModalModule, setTrainingModalModule] = useState<TrainingModule | null>(null);
  const [trainingModalTitle, setTrainingModalTitle] = useState("");
  const [trainingModalDesc, setTrainingModalDesc] = useState("");

  // AI search state
  const [aiSearching, setAiSearching] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiRankedIds, setAiRankedIds] = useState<string[]>([]);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [aiHasRelevant, setAiHasRelevant] = useState(true);
  const [aiSearchDone, setAiSearchDone] = useState(false);
  const searchTimerRef = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user) {
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
      fetchTrainingRatings();
    }
    fetchTrainingModules();
    fetchContacts();
  }, [user]);

  const fetchContacts = async () => {
    const { data } = await supabase.from("profiles").select("id, name, cargo, facility_unit");
    if (data) setContacts(data as ProfileContact[]);
  };

  const fetchTrainingModules = async () => {
    const { data } = await supabase.from("training_modules").select("*").order("sort_order");
    if (data) {
      setTrainingModules(data as TrainingModule[]);
      fetchAllRatings(data.map((m: any) => m.id));
    }
  };

  const fetchTrainingRatings = async () => {
    if (!user) return;
    const { data } = await supabase.from("training_ratings").select("module_id, rating").eq("user_id", user.id);
    if (data) {
      const map: Record<string, number> = {};
      (data as Rating[]).forEach(r => { map[r.module_id] = r.rating; });
      setTrainingRatings(map);
    }
  };

  const fetchAllRatings = async (moduleIds: string[]) => {
    const { data } = await supabase.from("training_ratings").select("module_id, rating");
    if (data) {
      const map: Record<string, { total: number; count: number }> = {};
      (data as Rating[]).forEach(r => {
        if (!map[r.module_id]) map[r.module_id] = { total: 0, count: 0 };
        map[r.module_id].total += r.rating;
        map[r.module_id].count += 1;
      });
      const avgMap: Record<string, { avg: number; count: number }> = {};
      Object.entries(map).forEach(([id, v]) => { avgMap[id] = { avg: v.total / v.count, count: v.count }; });
      setAvgRatings(avgMap);
    }
  };

  const handleRate = async (moduleId: string, rating: number) => {
    if (!user) return;
    const existing = trainingRatings[moduleId];
    if (existing) {
      await supabase.from("training_ratings").update({ rating }).eq("module_id", moduleId).eq("user_id", user.id);
    } else {
      await supabase.from("training_ratings").insert({ module_id: moduleId, user_id: user.id, rating });
    }
    setTrainingRatings(prev => ({ ...prev, [moduleId]: rating }));
    fetchAllRatings(trainingModules.map(m => m.id));
  };

  const openTrainingCreate = () => {
    setTrainingModalMode("create");
    setTrainingModalModule(null);
    setTrainingModalTitle("");
    setTrainingModalDesc("");
    setTrainingModalOpen(true);
  };

  const openTrainingEdit = (mod: TrainingModule) => {
    setTrainingModalMode("edit");
    setTrainingModalModule(mod);
    setTrainingModalTitle(mod.title);
    setTrainingModalDesc(mod.description);
    setTrainingModalOpen(true);
  };

  const handleTrainingModalSave = async () => {
    if (trainingModalMode === "create") {
      if (!trainingModalTitle.trim()) return;
      const maxOrder = trainingModules.length > 0 ? Math.max(...trainingModules.map(m => m.sort_order)) + 1 : 0;
      const { data } = await supabase.from("training_modules").insert({
        title: trainingModalTitle.trim(), description: trainingModalDesc.trim(), sort_order: maxOrder, created_by: user?.id,
      } as any).select().single();
      toast.success("Módulo criado");
      await fetchTrainingModules();
      if (data) { setTrainingModalMode("edit"); setTrainingModalModule(data as TrainingModule); }
    } else {
      if (!trainingModalModule) return;
      await supabase.from("training_modules").update({ title: trainingModalTitle, description: trainingModalDesc }).eq("id", trainingModalModule.id);
      toast.success("Módulo atualizado");
      setTrainingModalOpen(false);
      fetchTrainingModules();
    }
  };

  const handleVideoUpload = async (moduleId: string, file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${moduleId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("training-videos").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Erro ao enviar vídeo"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("training-videos").getPublicUrl(path);
    await supabase.from("training_modules").update({ video_url: urlData.publicUrl, video_uploaded_at: new Date().toISOString() } as any).eq("id", moduleId);
    toast.success("Vídeo enviado");
    setUploading(false);
    fetchTrainingModules();
    if (trainingModalModule?.id === moduleId) {
      setTrainingModalModule(prev => prev ? { ...prev, video_url: urlData.publicUrl, video_uploaded_at: new Date().toISOString() } : null);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    await supabase.from("training_ratings").delete().eq("module_id", moduleId);
    await supabase.storage.from("training-videos").remove([`${moduleId}.mp4`, `${moduleId}.webm`, `${moduleId}.mov`]);
    await supabase.from("training_modules").delete().eq("id", moduleId);
    toast.success("Módulo excluído");
    setTrainingModalOpen(false);
    fetchTrainingModules();
  };

  const handleVideoDelete = async (moduleId: string) => {
    await supabase.storage.from("training-videos").remove([`${moduleId}.mp4`, `${moduleId}.webm`, `${moduleId}.mov`]);
    await supabase.from("training_modules").update({ video_url: null, video_uploaded_at: null } as any).eq("id", moduleId);
    toast.success("Vídeo removido");
    fetchTrainingModules();
    if (trainingModalModule?.id === moduleId) {
      setTrainingModalModule(prev => prev ? { ...prev, video_url: null, video_uploaded_at: null } : null);
    }
  };

  const handleAiSearch = async (query: string) => {
    if (!query.trim() || trainingModules.length === 0) {
      setAiSearchDone(false);
      setAiRankedIds([]);
      setAiExplanations({});
      setAiSuggestion("");
      setAiHasRelevant(true);
      return;
    }
    setAiSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("training-search", {
        body: {
          query: query.trim(),
          modules: trainingModules.map(m => ({ id: m.id, title: m.title, description: m.description })),
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      const rankedIndices: number[] = data.ranked_indices || [];
      const explanations: string[] = data.explanations || [];
      const ids = rankedIndices
        .map(idx => trainingModules[idx - 1]?.id)
        .filter(Boolean);
      const explMap: Record<string, string> = {};
      rankedIndices.forEach((idx, i) => {
        const mod = trainingModules[idx - 1];
        if (mod && explanations[i]) explMap[mod.id] = explanations[i];
      });

      setAiRankedIds(ids);
      setAiExplanations(explMap);
      setAiSuggestion(data.suggestion || "");
      setAiHasRelevant(data.has_relevant !== false);
      setAiSearchDone(true);
    } catch (e) {
      console.error("AI search error:", e);
      toast.error("Erro na busca inteligente");
    } finally {
      setAiSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setAiSearchDone(false);
    if (searchTimerRef[0]) clearTimeout(searchTimerRef[0]);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) handleAiSearch(searchQuery);
  };

  const visibleModules = useMemo(() => {
    const sorted = [...trainingModules].sort((a, b) => {
      const aCustom = a.created_by ? 1 : 0;
      const bCustom = b.created_by ? 1 : 0;
      if (bCustom !== aCustom) return bCustom - aCustom;
      return a.sort_order - b.sort_order;
    });

    if (aiSearchDone && aiRankedIds.length > 0) {
      // AI-ranked order
      const ranked = aiRankedIds.map(id => sorted.find(m => m.id === id)).filter(Boolean) as TrainingModule[];
      const rest = sorted.filter(m => !aiRankedIds.includes(m.id));
      return [...ranked, ...rest];
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(m => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
  }, [trainingModules, searchQuery, aiSearchDone, aiRankedIds]);

  const showContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return false;
    return visibleModules.length === 0;
  }, [searchQuery, visibleModules]);

  const matchedContacts = useMemo(() => {
    if (!showContacts) return [];
    const q = searchQuery.trim().toLowerCase();
    const matched = contacts.filter(c => c.name.toLowerCase().includes(q) || (c.cargo?.toLowerCase().includes(q)) || c.facility_unit.toLowerCase().includes(q));
    return matched.length > 0 ? matched.slice(0, 5) : contacts.slice(0, 5);
  }, [showContacts, searchQuery, contacts]);

  /* ══ Navigation ══ */
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
    setEntryValue(""); setEntryDate(""); setEntryNotes("");
    setRubricaValue(""); setRubricaDate(""); setRubricaNotes("");
  };

  const goToFinalizado = (title: string, details: string[], redirectTo?: string) => {
    setFinalizadoData({ title, details, redirectTo });
    goTo("finalizado");
  };

  /* ══ Goal data loading ══ */
  const loadGoals = async (unit: string) => {
    setLoading(true);
    const { data, error } = await supabase.from("goals").select("*").eq("facility_unit", unit as any);
    if (error) { toast.error("Erro ao carregar metas"); setLoading(false); return; }
    setGoals(((data as Goal[]) || []).sort((a, b) => a.name.localeCompare(b.name)));
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

  const handleSubmitEntry = async () => {
    if (!user || !selectedGoal) return;
    if (!entryValue || !entryDate) { toast.error("Preencha o valor e a data"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("goal_entries").insert({
      goal_id: selectedGoal.id, user_id: user.id, value: parseFloat(entryValue), period: entryDate, notes: entryNotes || null,
    });
    if (error) { toast.error("Erro ao salvar lançamento"); setSubmitting(false); return; }
    toast.success("Lançamento salvo!");
    setSubmitting(false);
    goToFinalizado("Lançamento de meta realizado", [
      `Meta: ${selectedGoal.name}`,
      `Unidade: ${selectedUnit}`,
      `Valor lançado: ${entryValue}${selectedGoal.unit}`,
      `Data: ${entryDate}`,
      entryNotes ? `Observações: ${entryNotes}` : "",
    ].filter(Boolean));
    resetForm();
    await loadGoals(selectedUnit);
  };

  const handleSubmitRubrica = () => {
    if (!rubricaValue || !rubricaDate) { toast.error("Preencha o valor e a data"); return; }
    const contract = RUBRICA_CONTRACTS.find(c => c.id === selectedContract);
    goToFinalizado("Lançamento de rubrica realizado", [
      `Rubrica: ${selectedRubrica}`,
      `Contrato: ${contract?.unit || ""}`,
      `Valor executado: R$ ${rubricaValue}`,
      `Data: ${rubricaDate}`,
      `Mês de referência: ${selectedMonth}`,
      rubricaNotes ? `Observações: ${rubricaNotes}` : "",
    ].filter(Boolean));
    resetForm();
  };

  const formatCurrency = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
    return `R$ ${v.toFixed(0)}`;
  };

  /* ══ Step metadata ══ */
  const getStepInfo = () => {
    switch (step) {
      case "inicio": return { title: "Assistente", desc: "O que deseja fazer? Selecione uma opção para começar.", progress: 20 };
      case "cadastrar": return { title: "Cadastrar / Lançar dados", desc: "Escolha o tipo de registro ou lançamento.", progress: 40 };
      case "consultar": return { title: "Consultar informações", desc: "Acesse rapidamente as informações cadastradas.", progress: 40 };
      case "relatorios": return { title: "Gerar relatórios", desc: "Selecione o tipo de relatório desejado.", progress: 40 };
      case "relatorio-select": return { title: "Relatórios disponíveis", desc: "Escolha o relatório que deseja gerar ou consultar.", progress: 60 };
      case "treinamento": return { title: "Treinamento do Sistema", desc: "Assista vídeos e aprenda a usar cada módulo.", progress: 40 };
      case "lancar-meta-unit": return { title: "Lançar meta — Selecione a unidade", desc: "De qual unidade deseja lançar?", progress: 40 };
      case "lancar-meta-select": return { title: `Lançar meta — ${selectedUnit}`, desc: "Selecione a meta.", progress: 60 };
      case "lancar-meta-form": return { title: `Lançar: ${selectedGoal?.name || ""}`, desc: "Registre o valor realizado.", progress: 80 };
      case "lancar-rubrica-unit": return { title: "Lançar rubrica — Selecione o contrato", desc: "De qual contrato deseja lançar?", progress: 40 };
      case "lancar-rubrica-select": return { title: "Lançar rubrica — Selecione a rubrica", desc: "Qual rubrica deseja lançar?", progress: 60 };
      case "lancar-rubrica-form": return { title: `Lançar: ${selectedRubrica}`, desc: "Registre o valor executado.", progress: 80 };
      case "consultar-metas-unit": return { title: "Consultar metas — Selecione a unidade", desc: "De qual unidade deseja consultar?", progress: 40 };
      case "consultar-metas-list": return { title: `Metas — ${selectedUnit}`, desc: "Metas cadastradas e atingimentos.", progress: 80 };
      case "enviar-evidencia-contract": return { title: "Enviar Evidência — Selecione o contrato", desc: "Vincule a evidência a um contrato de gestão.", progress: 50 };
      case "finalizado": return { title: "Concluído", desc: "Ação realizada com sucesso.", progress: 100 };
      default: return { title: "", desc: "", progress: 0 };
    }
  };

  const stepInfo = getStepInfo();

  /* ══ Cards per step ══ */
  const getCards = (): WizardCard[] => {
    switch (step) {
      case "inicio":
        return [
          { id: "cadastrar", title: "Cadastrar / Lançar dados", description: "Registre metas, contratos, evidências ou faça lançamentos de metas e rubricas.", action: () => goTo("cadastrar") },
          { id: "consultar", title: "Consultar informações", description: "Visualize metas, contratos, rubricas e evidências cadastrados.", action: () => goTo("consultar") },
          { id: "relatorios", title: "Gerar relatórios", description: "Crie relatórios em PDF com dados consolidados do sistema.", action: () => goTo("relatorio-select") },
          { id: "treinamento", title: "Treinamento do Sistema", description: "Assista vídeos explicativos e aprenda a usar cada módulo do sistema.", action: () => goTo("treinamento") },
        ];
      case "cadastrar":
        return [
          { id: "nova-meta", title: "Cadastrar Meta", description: "Crie uma nova meta quantitativa, qualitativa ou documental vinculada a uma unidade.", action: () => setGoalModalOpen(true) },
          { id: "novo-contrato", title: "Cadastrar Contrato", description: "Registre um novo contrato de gestão com valores, rubricas e PDF.", action: () => setContractModalOpen(true) },
          { id: "nova-evidencia", title: "Enviar Evidência", description: "Faça upload de documentos comprobatórios vinculados a um contrato.", action: () => goTo("enviar-evidencia-contract") },
          { id: "lancar-meta", title: "Lançar Meta", description: "Selecione unidade e meta para registrar o valor realizado no período.", action: () => goTo("lancar-meta-unit") },
          { id: "lancar-rubrica", title: "Lançar Rubrica", description: "Registre valores executados por rubrica orçamentária.", action: () => goTo("lancar-rubrica-unit") },
        ];
      case "consultar":
        return [
          { id: "ver-metas", title: "Ver Metas", description: "Consulte metas com atingimento, histórico de lançamentos e gauge.", action: () => goTo("consultar-metas-unit") },
          { id: "ver-contratos", title: "Ver Contratos", description: "Contratos vigentes, valores, rubricas e status.", action: () => goToFinalizado("Redirecionando para Contratos", ["Abrindo página de contratos de gestão.", "Consulte valores, rubricas e status de cada contrato."], "/contratos") },
          { id: "ver-rubricas", title: "Ver Rubricas e Riscos", description: "Execução orçamentária e projeção de risco por contrato.", action: () => goToFinalizado("Redirecionando para Rubricas", ["Abrindo controle de rubricas e análise de risco.", "Verifique a execução orçamentária por contrato."], "/controle-rubrica") },
          { id: "ver-evidencias", title: "Ver Evidências", description: "Documentos enviados, pendentes e status de validação.", action: () => goToFinalizado("Redirecionando para Evidências", ["Abrindo painel de evidências.", "Consulte documentos enviados e pendentes."], "/evidencias") },
          { id: "ver-sau", title: "Ver SAU", description: "Serviço de Atendimento ao Usuário — indicadores e ocorrências.", action: () => goToFinalizado("Redirecionando para SAU", ["Abrindo Serviço de Atendimento ao Usuário.", "Consulte indicadores e ocorrências registradas."], "/sau") },
          { id: "ver-relatorio", title: "Relatório Assistencial", description: "Indicadores e dados assistenciais detalhados por unidade.", action: () => goToFinalizado("Redirecionando para Relatório Assistencial", ["Abrindo relatório assistencial detalhado.", "Analise indicadores por unidade de saúde."], "/relatorio-assistencial") },
        ];
      case "relatorio-select":
        return REPORT_OPTIONS.map(r => ({
          id: r.id,
          title: r.title,
          description: r.description,
          action: () => {
            if (r.id === "pdf-export") {
              setPdfModalOpen(true);
            } else {
              const routeMap: Record<string, string> = {
                assistencial: "/relatorio-assistencial",
                consolidado: "/relatorios",
                rdqa: "/relatorios",
                contrato: "/relatorios",
                metas: "/relatorios",
                risco: "/controle-rubrica",
                evidencias: "/evidencias",
              };
              goToFinalizado(`Relatório: ${r.title}`, [
                r.description,
                "Clique abaixo para acessar o relatório selecionado.",
              ], routeMap[r.id] || "/relatorios");
            }
          },
        }));
      case "enviar-evidencia-contract":
        return contracts.map(c => ({
          id: c.id,
          title: c.name,
          description: `${c.unit} — ${c.status} — Período: ${c.period}`,
          action: () => {
            setEvidenceContractId(c.id);
            setEvidenceModalOpen(true);
          },
        }));
      case "lancar-meta-unit":
        return UNITS.map(u => ({ id: u, title: u, description: `Lançar metas da unidade ${u}`, action: () => { setSelectedUnit(u); loadGoals(u); goTo("lancar-meta-select"); } }));
      case "lancar-rubrica-unit":
        return RUBRICA_CONTRACTS.map(c => ({ id: c.id, title: c.unit, description: `Contrato: ${c.unit}`, action: () => { setSelectedContract(c.id); goTo("lancar-rubrica-select"); } }));
      case "consultar-metas-unit":
        return UNITS.map(u => ({ id: u, title: u, description: `Consultar metas de ${u}`, action: () => { setSelectedUnit(u); loadGoals(u); goTo("consultar-metas-list"); } }));
      default:
        return [];
    }
  };

  const cards = getCards();

  /* ══ Templates ══ */
  const newGoalTemplate: GoalData = {
    id: "", name: "", target: 0, current: 0, unit: "%", type: "QNT", risk: 0, weight: 1, trend: "stable",
    scoring: [{ min: 0, label: "Insuficiente", points: 0 }, { min: 50, label: "Regular", points: 50 }, { min: 80, label: "Bom", points: 80 }, { min: 100, label: "Ótimo", points: 100 }],
    history: [], glosaPct: 0,
  };
  const newEvidenceTemplate: EvidenceData = { id: "", goalName: "", type: "PDF", fileName: "", status: "Pendente", dueDate: new Date().toISOString().split("T")[0], notes: "", contractId: evidenceContractId };

  /* ══ Inline renders ══ */
  const isInlineStep = ["lancar-meta-select", "lancar-meta-form", "lancar-rubrica-select", "lancar-rubrica-form", "consultar-metas-list", "treinamento", "finalizado"].includes(step);

  const HeartRating = ({ moduleId }: { moduleId: string }) => {
    const myRating = trainingRatings[moduleId] || 0;
    const [hover, setHover] = useState(0);
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} type="button" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => handleRate(moduleId, i)} className="transition-transform hover:scale-125">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5 transition-colors"
              fill={(hover || myRating) >= i ? "hsl(var(--primary))" : "none"}
              stroke={(hover || myRating) >= i ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} strokeWidth={2}>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
        ))}
        {avgRatings[moduleId] && (
          <span className="ml-2 text-[10px] text-muted-foreground">{avgRatings[moduleId].avg.toFixed(1)} ({avgRatings[moduleId].count})</span>
        )}
      </div>
    );
  };

  const renderTrainamento = () => (
    <div>
      {/* AI-powered search */}
      <div className="kpi-card p-5 mb-6">
        <p className="text-sm font-semibold text-foreground mb-1">Qual sua dúvida?</p>
        <p className="text-xs text-muted-foreground mb-3">
          Descreva o que você precisa aprender e vamos direcioná-lo para o conteúdo mais relevante.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Ex: Como faço para lançar metas? Como funciona o controle de rubrica?"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSearchSubmit(); }}
            className="flex-1"
          />
          <Button size="sm" onClick={handleSearchSubmit} disabled={aiSearching || !searchQuery.trim()}>
            {aiSearching ? "Buscando..." : "Buscar"}
          </Button>
          {searchQuery && (
            <Button variant="outline" size="sm" onClick={() => { handleSearchChange(""); setAiSearchDone(false); setAiSuggestion(""); setAiRankedIds([]); setAiExplanations({}); }}>
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* AI suggestion banner */}
      {aiSearchDone && aiSuggestion && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="kpi-card p-4 mb-6 border-primary/20 bg-primary/5">
          <p className="text-xs font-semibold text-primary mb-1">Sugestão do assistente</p>
          <p className="text-sm text-foreground">{aiSuggestion}</p>
        </motion.div>
      )}

      {/* Loading state */}
      {aiSearching && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
          <p className="text-sm text-muted-foreground">Analisando sua dúvida com inteligência artificial...</p>
        </motion.div>
      )}

      {/* No relevant results - show contacts */}
      {aiSearchDone && !aiHasRelevant && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="kpi-card mb-6">
          <p className="text-sm font-medium text-foreground mb-1">Nenhum módulo diretamente relacionado encontrado</p>
          <p className="text-xs text-muted-foreground mb-3">Entre em contato com alguém da equipe para tirar sua dúvida:</p>
          <div className="space-y-2">
            {(matchedContacts.length > 0 ? matchedContacts : contacts.slice(0, 5)).map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.cargo || "Sem cargo"} • {c.facility_unit}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`mailto:${c.name.toLowerCase().replace(/\s/g, ".")}@moss.org?subject=Dúvida sobre ${searchQuery}`} className="px-3 py-1.5 text-xs rounded-full bg-primary text-primary-foreground hover:brightness-110 transition">Email</a>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Olá ${c.name}, tenho uma dúvida sobre: ${searchQuery}`)}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs rounded-full bg-[hsl(142_71%_45%)] text-white hover:brightness-110 transition">WhatsApp</a>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Admin + fallback contacts (old behavior preserved) */}
      {!aiSearchDone && showContacts && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="kpi-card mb-6">
          <p className="text-sm font-medium text-foreground mb-1">Nenhum módulo encontrado para "{searchQuery}"</p>
          <p className="text-xs text-muted-foreground mb-3">Entre em contato com alguém da equipe:</p>
          <div className="space-y-2">
            {matchedContacts.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.cargo || "Sem cargo"} • {c.facility_unit}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`mailto:${c.name.toLowerCase().replace(/\s/g, ".")}@moss.org?subject=Dúvida sobre ${searchQuery}`} className="px-3 py-1.5 text-xs rounded-full bg-primary text-primary-foreground hover:brightness-110 transition">Email</a>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Olá ${c.name}, tenho uma dúvida sobre: ${searchQuery}`)}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs rounded-full bg-[hsl(142_71%_45%)] text-white hover:brightness-110 transition">WhatsApp</a>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Admin actions */}
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <Button size="sm" onClick={openTrainingCreate}>Novo card</Button>
        </div>
      )}

      {/* Modules grid */}
      {!aiSearching && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleModules.map((mod, i) => {
            const isTopRecommendation = aiSearchDone && aiRankedIds.indexOf(mod.id) < 3 && aiRankedIds.indexOf(mod.id) >= 0;
            const explanation = aiExplanations[mod.id];
            return (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`kpi-card flex flex-col gap-3 ${isTopRecommendation ? "ring-2 ring-primary/30 border-primary/20" : ""}`}
              >
                {isTopRecommendation && (
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full self-start">
                    Recomendado para você
                  </span>
                )}
                {explanation && (
                  <p className="text-[11px] text-primary/80 leading-snug">{explanation}</p>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h2 className="text-sm font-bold text-foreground">{mod.title}</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">{mod.description}</p>
                  </div>
                  {isAdmin && <Button variant="outline" size="sm" className="rounded-full text-[10px] shrink-0" onClick={() => openTrainingEdit(mod)}>Editar</Button>}
                </div>
                {mod.video_url ? (
                  <div className="space-y-1">
                    <button type="button" onClick={() => setPlayModule(mod)} className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center hover:bg-muted/70 transition-colors border border-border">
                      <span className="text-2xl">▶</span>
                    </button>
                    {mod.video_uploaded_at && <p className="text-[10px] text-muted-foreground">Enviado em {new Date(mod.video_uploaded_at).toLocaleDateString("pt-BR")}</p>}
                  </div>
                ) : (
                  <div className="w-full aspect-video bg-muted/50 rounded-lg flex items-center justify-center border border-dashed border-border">
                    <span className="text-xs text-muted-foreground">Sem vídeo</span>
                  </div>
                )}
                <HeartRating moduleId={mod.id} />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );

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
            <motion.button key={goal.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => { setSelectedGoal(goal); resetForm(); goTo("lancar-meta-form"); }}
              className="kpi-card text-left cursor-pointer group p-5 hover:ring-2 hover:ring-primary/30 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors text-sm">{goal.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Meta: {goal.target}{goal.unit} — Peso: {(goal.weight * 100).toFixed(0)}% — {existing.length} lançamento(s)</p>
                </div>
                <div className="ml-4"><GoalGauge percent={attainment} size={60} /></div>
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
        <p className="text-xs text-muted-foreground mb-4">Meta: {selectedGoal.target}{selectedGoal.unit} — Peso: {(selectedGoal.weight * 100).toFixed(0)}% — {selectedUnit}</p>
        <div className="flex justify-center mb-4"><GoalGauge percent={attainment} size={100} /></div>
        <div className="bg-secondary/50 rounded-lg p-2 text-center mb-4">
          <p className="text-xs text-muted-foreground">Faltam <span className="font-semibold text-foreground">{remaining.toFixed(1)}{selectedGoal.unit}</span></p>
        </div>
        {existing.length > 0 && (
          <div className="mb-4 p-3 bg-secondary/50 rounded">
            <p className="text-xs text-muted-foreground mb-1">Lançamentos anteriores:</p>
            <div className="flex flex-wrap gap-1">
              {existing.map((e, idx) => <span key={idx} className="text-xs bg-background px-1.5 py-0.5 rounded border border-border">{e.period}: {e.value}{selectedGoal.unit}</span>)}
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
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !entryDate && "text-muted-foreground")}>{entryDate || "Selecione o dia"}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={entryDate ? new Date(entryDate.split("/").reverse().join("-")) : undefined} onSelect={date => { if (date) setEntryDate(format(date, "dd/MM/yyyy")); }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <Textarea placeholder="Observações (opcional)" value={entryNotes} onChange={e => setEntryNotes(e.target.value)} className="min-h-[60px]" />
          <Button className="w-full" disabled={submitting} onClick={handleSubmitEntry}>{submitting ? "Salvando..." : "Lançar"}</Button>
        </div>
      </motion.div>
    );
  };

  const renderLancarRubricaSelect = () => {
    const contract = RUBRICA_CONTRACTS.find(c => c.id === selectedContract);
    if (!contract) return <p className="text-muted-foreground text-center py-12">Contrato não encontrado.</p>;
    return (
      <div className="grid grid-cols-1 gap-3">
        {RUBRICA_NAMES.map((rubName, i) => {
          const existing = ALL_ENTRIES.find(e => e.unit === contract.unit && e.month === selectedMonth && e.rubrica === rubName);
          const allocated = existing?.valorAllocated || 0;
          const executed = existing?.valorExecuted || 0;
          const pct = allocated > 0 ? Math.round((executed / allocated) * 100) : 0;
          return (
            <motion.button key={rubName} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => { setSelectedRubrica(rubName); resetForm(); goTo("lancar-rubrica-form"); }}
              className="kpi-card text-left cursor-pointer group p-5 hover:ring-2 hover:ring-primary/30 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors text-sm">{rubName}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Alocado: {formatCurrency(allocated)} — Executado: {formatCurrency(executed)}</p>
                </div>
                <div className="ml-4"><GoalGauge percent={pct} size={60} /></div>
              </div>
            </motion.button>
          );
        })}
      </div>
    );
  };

  const renderLancarRubricaForm = () => {
    const contract = RUBRICA_CONTRACTS.find(c => c.id === selectedContract);
    if (!contract) return null;
    const existing = ALL_ENTRIES.find(e => e.unit === contract.unit && e.month === selectedMonth && e.rubrica === selectedRubrica);
    const allocated = existing?.valorAllocated || 0;
    const executed = existing?.valorExecuted || 0;
    const pct = allocated > 0 ? Math.round((executed / allocated) * 100) : 0;
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card p-6 max-w-lg mx-auto">
        <h3 className="font-display font-semibold text-foreground mb-1">{selectedRubrica}</h3>
        <p className="text-xs text-muted-foreground mb-4">Contrato: {contract.unit}</p>
        <div className="flex justify-center mb-4"><GoalGauge percent={pct} size={100} /></div>
        <div className="bg-secondary/50 rounded-lg p-2 text-center mb-4">
          <p className="text-xs text-muted-foreground">Alocado: <span className="font-semibold text-foreground">{formatCurrency(allocated)}</span> — Executado: <span className="font-semibold text-foreground">{formatCurrency(executed)}</span> — Saldo: <span className="font-semibold text-foreground">{formatCurrency(allocated - executed)}</span></p>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs text-muted-foreground block mb-1">Mês de referência</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground block mb-1">Valor executado</label><Input type="number" step="0.01" placeholder="R$ 0,00" value={rubricaValue} onChange={e => setRubricaValue(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground block mb-1">Data do lançamento</label>
              <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !rubricaDate && "text-muted-foreground")}>{rubricaDate || "Selecione o dia"}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={rubricaDate ? new Date(rubricaDate.split("/").reverse().join("-")) : undefined} onSelect={date => { if (date) setRubricaDate(format(date, "dd/MM/yyyy")); }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" /></PopoverContent></Popover>
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
    const totalGoals = goals.length;
    const totalEntries = goals.reduce((s, g) => s + (existingEntries[g.id]?.length || 0), 0);
    const avgAttainment = goals.length > 0 ? Math.round(goals.reduce((s, g) => {
      const entries = existingEntries[g.id] || [];
      const val = entries.reduce((a, e) => a + e.value, 0);
      return s + (g.target > 0 ? Math.min(100, (val / g.target) * 100) : 0);
    }, 0) / goals.length) : 0;
    const criticalGoals = goals.filter(g => {
      const entries = existingEntries[g.id] || [];
      const val = entries.reduce((a, e) => a + e.value, 0);
      return g.target > 0 && (val / g.target) * 100 < 50;
    });
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {goals.map((goal, i) => {
            const existing = existingEntries[goal.id] || [];
            const currentVal = existing.reduce((s, e) => s + e.value, 0);
            const attainment = goal.target > 0 ? Math.min(100, Math.round((currentVal / goal.target) * 100)) : 0;
            const remaining = Math.max(0, goal.target - currentVal);
            return (
              <motion.div key={goal.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="kpi-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-display font-semibold text-foreground text-sm">{goal.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Meta: {goal.target}{goal.unit} — Peso: {(goal.weight * 100).toFixed(0)}% — {goal.type}</p>
                  </div>
                  <GoalGauge percent={attainment} size={70} />
                </div>
                <div className="bg-secondary/50 rounded-lg p-2 text-center mb-2">
                  <p className="text-xs text-muted-foreground">Realizado: <span className="font-semibold text-foreground">{currentVal.toFixed(1)}{goal.unit}</span> — Faltam: <span className="font-semibold text-foreground">{remaining.toFixed(1)}{goal.unit}</span></p>
                </div>
                {existing.length > 0 && (
                  <div className="p-2 bg-secondary/30 rounded">
                    <p className="text-xs text-muted-foreground mb-1">Lançamentos ({existing.length}):</p>
                    <div className="flex flex-wrap gap-1">
                      {existing.map((e, idx) => <span key={idx} className="text-xs bg-background px-1.5 py-0.5 rounded border border-border">{e.period}: {e.value}{goal.unit}</span>)}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Smart final actions */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="kpi-card p-6 mt-6 border-primary/20">
          <div className="text-center mb-4">
            <h3 className="font-display font-semibold text-foreground mb-1">Resumo — {selectedUnit}</h3>
            <p className="text-xs text-muted-foreground">
              {totalGoals} meta(s) cadastrada(s) · {totalEntries} lançamento(s) · Atingimento médio: {avgAttainment}%
            </p>
            {criticalGoals.length > 0 && (
              <p className="text-xs text-destructive mt-1 font-medium">
                ⚠ {criticalGoals.length} meta(s) com atingimento abaixo de 50%: {criticalGoals.map(g => g.name).join(", ")}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground text-center mb-4">O que deseja fazer agora?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="default" className="w-full" onClick={() => navigate("/relatorios")}>
              Gerar relatório de {selectedUnit}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => { goTo("lancar-meta-unit"); }}>
              Lançar uma meta
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setPdfModalOpen(true)}>
              Exportar PDF personalizado
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => { setStep("inicio"); setHistory([]); }}>
              Voltar ao início
            </Button>
          </div>
        </motion.div>
      </div>
    );
  };

  const getFinalizadoActions = () => {
    const title = finalizadoData.title.toLowerCase();
    const actions: { label: string; action: () => void; variant?: "default" | "outline" | "ghost" }[] = [];

    if (title.includes("meta cadastrada") || title.includes("lançamento de meta")) {
      actions.push({ label: "Gerar relatório de metas", action: () => navigate("/relatorios"), variant: "default" });
      actions.push({ label: "Lançar outra meta", action: () => goTo("lancar-meta-unit"), variant: "outline" });
      actions.push({ label: "Consultar metas", action: () => goTo("consultar-metas-unit"), variant: "outline" });
    } else if (title.includes("rubrica")) {
      actions.push({ label: "Ver controle de rubricas", action: () => navigate("/controle-rubrica"), variant: "default" });
      actions.push({ label: "Lançar outra rubrica", action: () => goTo("lancar-rubrica-unit"), variant: "outline" });
      actions.push({ label: "Gerar relatório por contrato", action: () => navigate("/relatorios"), variant: "outline" });
    } else if (title.includes("contrato")) {
      actions.push({ label: "Ver contratos", action: () => navigate("/contratos"), variant: "default" });
      actions.push({ label: "Cadastrar nova meta", action: () => setGoalModalOpen(true), variant: "outline" });
      if (title.includes("redirecionando")) {
        actions.push({ label: "Ir para Contratos", action: () => navigate("/contratos"), variant: "default" });
      }
    } else if (title.includes("evidência")) {
      actions.push({ label: "Ver evidências enviadas", action: () => navigate("/evidencias"), variant: "default" });
      actions.push({ label: "Enviar outra evidência", action: () => goTo("enviar-evidencia-contract"), variant: "outline" });
    } else if (title.includes("relatório")) {
      const dest = finalizadoData.redirectTo || "/relatorios";
      actions.push({ label: "Acessar relatório", action: () => navigate(dest), variant: "default" });
      actions.push({ label: "Exportar PDF personalizado", action: () => setPdfModalOpen(true), variant: "outline" });
      actions.push({ label: "Escolher outro relatório", action: () => goTo("relatorio-select"), variant: "outline" });
    } else if (title.includes("redirecionando")) {
      // Extract destination from title
      if (title.includes("rubrica")) actions.push({ label: "Ir para Rubricas", action: () => navigate("/controle-rubrica"), variant: "default" });
      else if (title.includes("evidência")) actions.push({ label: "Ir para Evidências", action: () => navigate("/evidencias"), variant: "default" });
      else if (title.includes("sau")) actions.push({ label: "Ir para SAU", action: () => navigate("/sau"), variant: "default" });
      else if (title.includes("assistencial")) actions.push({ label: "Ir para Relatório", action: () => navigate("/relatorio-assistencial"), variant: "default" });
      actions.push({ label: "Gerar relatório", action: () => goTo("relatorio-select"), variant: "outline" });
    }

    actions.push({ label: "Voltar ao início do assistente", action: () => { setStep("inicio"); setHistory([]); }, variant: "ghost" });
    actions.push({ label: "Ir para o Dashboard", action: () => navigate("/dashboard"), variant: "ghost" });
    return actions;
  };

  const renderFinalizado = () => {
    const actions = getFinalizadoActions();
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg mx-auto text-center">
        <div className="kpi-card p-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-primary">✓</span>
          </div>
          <h2 className="font-display font-bold text-xl text-foreground mb-2">{finalizadoData.title}</h2>
          <p className="text-sm text-muted-foreground mb-6">Confira o resumo abaixo:</p>
          <div className="bg-secondary/30 rounded-lg p-4 text-left space-y-1.5 mb-6">
            {finalizadoData.details.map((detail, i) => (
              <p key={i} className="text-sm text-foreground">{detail}</p>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {actions.map((a, i) => (
              <Button key={i} variant={a.variant || "default"} className="w-full" onClick={a.action}>{a.label}</Button>
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderInlineContent = () => {
    switch (step) {
      case "lancar-meta-select": return renderLancarMetaSelect();
      case "lancar-meta-form": return renderLancarMetaForm();
      case "lancar-rubrica-select": return renderLancarRubricaSelect();
      case "lancar-rubrica-form": return renderLancarRubricaForm();
      case "consultar-metas-list": return renderConsultarMetasList();
      case "treinamento": return renderTrainamento();
      case "finalizado": return renderFinalizado();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      <main className={cn("mx-auto px-4 sm:px-6 lg:px-8 py-8", step === "treinamento" ? "max-w-5xl" : "max-w-3xl")}>
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" onClick={goBack} className="text-sm">Voltar</Button>
          </div>
          <Progress value={stepInfo.progress} className="h-2" />
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">{stepInfo.title}</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">{stepInfo.desc}</p>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {isInlineStep ? (
            <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
              {renderInlineContent()}
            </motion.div>
          ) : (
            <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className="grid grid-cols-1 gap-4">
              {cards.map((card, i) => (
                <motion.button key={card.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  onClick={card.action} className="kpi-card text-left cursor-pointer group p-6 hover:ring-2 hover:ring-primary/30 transition-all">
                  <h3 className="font-display font-semibold text-lg text-foreground group-hover:text-primary transition-colors mb-1">{card.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Wizard Modals */}
      <GoalFormModal goal={newGoalTemplate} open={goalModalOpen} onOpenChange={setGoalModalOpen} onSave={() => {
        setGoalModalOpen(false);
        goToFinalizado("Meta cadastrada com sucesso", ["A meta foi criada e já está disponível para lançamentos.", "Você pode lançar valores acessando 'Lançar Meta' no assistente."]);
      }} isNew />
      <ContractFormModal contract={null} open={contractModalOpen} onOpenChange={setContractModalOpen} onSave={() => {
        setContractModalOpen(false);
        goToFinalizado("Contrato cadastrado com sucesso", ["O contrato de gestão foi registrado no sistema.", "As rubricas e metas vinculadas já estão disponíveis."]);
      }} isNew />
      <EvidenceFormModal
        evidence={{ ...newEvidenceTemplate, contractId: evidenceContractId }}
        open={evidenceModalOpen}
        onOpenChange={setEvidenceModalOpen}
        onSave={() => {
          setEvidenceModalOpen(false);
          const contract = contracts.find(c => c.id === evidenceContractId);
          goToFinalizado("Evidência enviada com sucesso", [
            contract ? `Contrato vinculado: ${contract.name}` : "",
            "O documento foi registrado e está aguardando validação.",
            "Acompanhe o status em Consultar → Ver Evidências.",
          ].filter(Boolean));
        }}
        isNew
      />
      <PdfExportModal open={pdfModalOpen} onOpenChange={setPdfModalOpen} onGenerate={() => {
        setPdfModalOpen(false);
        goToFinalizado("Relatório gerado com sucesso", ["O PDF foi gerado e está pronto para download.", "Você pode acessar seus relatórios anteriores na página de Relatórios."]);
      }} />

      {/* Training create/edit modal */}
      <Dialog open={trainingModalOpen} onOpenChange={setTrainingModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">{trainingModalMode === "create" ? "Novo card de conhecimento" : "Editar módulo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={trainingModalTitle} onChange={e => setTrainingModalTitle(e.target.value)} placeholder="Ex: Dashboard" /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={trainingModalDesc} onChange={e => setTrainingModalDesc(e.target.value)} rows={4} placeholder="Descreva o módulo..." /></div>
            {trainingModalMode === "edit" && trainingModalModule && (
              <div className="space-y-2">
                <Label>Vídeo</Label>
                {trainingModalModule.video_url ? (
                  <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-foreground font-medium">Vídeo anexado</p>
                        {trainingModalModule.video_uploaded_at && <p className="text-[10px] text-muted-foreground">Enviado em {new Date(trainingModalModule.video_uploaded_at).toLocaleDateString("pt-BR")}</p>}
                      </div>
                      <Button variant="destructive" size="sm" className="rounded-full text-[10px] h-7" onClick={() => handleVideoDelete(trainingModalModule.id)}>Remover vídeo</Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-border">
                    <p className="text-xs text-muted-foreground mb-2">Nenhum vídeo anexado</p>
                    <label className="cursor-pointer">
                      <span className="px-3 py-1.5 text-xs rounded-full bg-primary text-primary-foreground hover:brightness-110 transition inline-block">{uploading ? "Enviando..." : "Enviar vídeo"}</span>
                      <input type="file" accept="video/*" className="hidden" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) handleVideoUpload(trainingModalModule.id, file); }} />
                    </label>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleTrainingModalSave} disabled={!trainingModalTitle.trim()}>{trainingModalMode === "create" ? "Criar" : "Salvar"}</Button>
              <Button variant="outline" onClick={() => setTrainingModalOpen(false)}>Cancelar</Button>
            </div>
            {trainingModalMode === "edit" && trainingModalModule && isAdmin && (
              <div className="pt-2 border-t border-border">
                <Button variant="destructive" size="sm" className="w-full" onClick={() => { if (window.confirm("Excluir este módulo?")) handleDeleteModule(trainingModalModule.id); }}>Excluir módulo</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video player modal */}
      <Dialog open={!!playModule} onOpenChange={() => setPlayModule(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0"><DialogTitle className="font-display">{playModule?.title}</DialogTitle></DialogHeader>
          {playModule?.video_url && (
            <div className="p-4 pt-2"><video src={playModule.video_url} controls autoPlay className="w-full rounded-lg" style={{ maxHeight: "70vh" }} /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssistentePage;
