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
const MONTHS_LIST = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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
  | "relatorio-config"
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

/* ── Mock contract data for PDF generation ── */
interface ReportGoalItem {
  id: string; name: string; target: number; current: number; unit: string;
  type: "QNT" | "QLT" | "DOC"; risk: number; trend: "up" | "down" | "stable";
  rubrica: string; pesoFinanceiro: number;
}

interface ReportContractData {
  id: string; name: string; unit: string; valorGlobal: number;
  rubricas: { name: string; pct: number; valor: number }[];
  goals: ReportGoalItem[];
  performance: { month: string; atingidas: number; parciais: number; naoAtingidas: number }[];
  riskTrend: { month: string; risco: number; glosa: number }[];
}

const REPORT_CONTRACTS: ReportContractData[] = [
  {
    id: "c1", name: "Contrato de Gestão — Hospital Geral", unit: "Hospital Geral", valorGlobal: 2800000,
    rubricas: [
      { name: "RH", pct: 55, valor: 1540000 }, { name: "Insumos", pct: 20, valor: 560000 },
      { name: "Equipamentos", pct: 10, valor: 280000 }, { name: "Metas Quantitativas", pct: 10, valor: 280000 },
      { name: "Metas Qualitativas", pct: 5, valor: 140000 },
    ],
    goals: [
      { id: "g1", name: "Taxa de ocupação de leitos", target: 85, current: 78, unit: "%", type: "QNT", risk: 12400, trend: "down", rubrica: "Metas Quantitativas", pesoFinanceiro: 4.4 },
      { id: "g2", name: "Tempo médio de espera", target: 30, current: 42, unit: "min", type: "QNT", risk: 8200, trend: "up", rubrica: "Metas Quantitativas", pesoFinanceiro: 2.9 },
      { id: "g3", name: "Satisfação do paciente (NPS)", target: 75, current: 71, unit: "pts", type: "QNT", risk: 5600, trend: "stable", rubrica: "Metas Quantitativas", pesoFinanceiro: 2.0 },
      { id: "g4", name: "Protocolo de higienização", target: 100, current: 92, unit: "%", type: "QLT", risk: 3100, trend: "up", rubrica: "Metas Qualitativas", pesoFinanceiro: 2.2 },
      { id: "g5", name: "Relatório quadrimestral (RDQA)", target: 1, current: 0, unit: "doc", type: "DOC", risk: 15000, trend: "down", rubrica: "Metas Qualitativas", pesoFinanceiro: 5.4 },
      { id: "g6", name: "Taxa de infecção hospitalar", target: 5, current: 6.2, unit: "%", type: "QNT", risk: 9800, trend: "down", rubrica: "Metas Quantitativas", pesoFinanceiro: 3.5 },
    ],
    performance: [
      { month: "Jan", atingidas: 65, parciais: 20, naoAtingidas: 15 }, { month: "Fev", atingidas: 70, parciais: 18, naoAtingidas: 12 },
      { month: "Mar", atingidas: 68, parciais: 22, naoAtingidas: 10 }, { month: "Abr", atingidas: 75, parciais: 15, naoAtingidas: 10 },
    ],
    riskTrend: [
      { month: "Jan", risco: 85000, glosa: 12000 }, { month: "Fev", risco: 72000, glosa: 9500 },
      { month: "Mar", risco: 61800, glosa: 8200 }, { month: "Abr", risco: 54400, glosa: 7100 },
    ],
  },
  {
    id: "c2", name: "Contrato de Gestão — UPA Norte", unit: "UPA Norte", valorGlobal: 1200000,
    rubricas: [
      { name: "RH", pct: 60, valor: 720000 }, { name: "Insumos", pct: 18, valor: 216000 },
      { name: "Equipamentos", pct: 7, valor: 84000 }, { name: "Metas Quantitativas", pct: 10, valor: 120000 },
      { name: "Metas Qualitativas", pct: 5, valor: 60000 },
    ],
    goals: [
      { id: "g9", name: "Tempo porta-médico", target: 15, current: 12, unit: "min", type: "QNT", risk: 0, trend: "up", rubrica: "Metas Quantitativas", pesoFinanceiro: 0 },
      { id: "g10", name: "Atendimentos/dia", target: 200, current: 185, unit: "un", type: "QNT", risk: 3200, trend: "stable", rubrica: "Metas Quantitativas", pesoFinanceiro: 2.7 },
      { id: "g11", name: "Classificação de risco (Manchester)", target: 100, current: 97, unit: "%", type: "QLT", risk: 0, trend: "up", rubrica: "Metas Qualitativas", pesoFinanceiro: 0 },
      { id: "g12", name: "Taxa de retorno em 24h", target: 5, current: 7.8, unit: "%", type: "QNT", risk: 4100, trend: "down", rubrica: "Metas Quantitativas", pesoFinanceiro: 3.4 },
    ],
    performance: [
      { month: "Jan", atingidas: 72, parciais: 18, naoAtingidas: 10 }, { month: "Fev", atingidas: 78, parciais: 14, naoAtingidas: 8 },
      { month: "Mar", atingidas: 80, parciais: 12, naoAtingidas: 8 }, { month: "Abr", atingidas: 85, parciais: 10, naoAtingidas: 5 },
    ],
    riskTrend: [
      { month: "Jan", risco: 28000, glosa: 4200 }, { month: "Fev", risco: 22000, glosa: 3100 },
      { month: "Mar", risco: 18000, glosa: 2600 }, { month: "Abr", risco: 10100, glosa: 1800 },
    ],
  },
  {
    id: "c3", name: "Contrato de Gestão — UBS Centro", unit: "UBS Centro", valorGlobal: 680000,
    rubricas: [
      { name: "RH", pct: 65, valor: 442000 }, { name: "Insumos", pct: 15, valor: 102000 },
      { name: "Equipamentos", pct: 5, valor: 34000 }, { name: "Metas Quantitativas", pct: 10, valor: 68000 },
      { name: "Metas Qualitativas", pct: 5, valor: 34000 },
    ],
    goals: [
      { id: "g15", name: "Consultas agendadas realizadas", target: 90, current: 72, unit: "%", type: "QNT", risk: 5400, trend: "down", rubrica: "Metas Quantitativas", pesoFinanceiro: 7.9 },
      { id: "g16", name: "Cobertura vacinal", target: 95, current: 88, unit: "%", type: "QNT", risk: 3200, trend: "up", rubrica: "Metas Quantitativas", pesoFinanceiro: 4.7 },
      { id: "g17", name: "Visitas domiciliares ACS", target: 80, current: 65, unit: "%", type: "QNT", risk: 4600, trend: "down", rubrica: "Metas Quantitativas", pesoFinanceiro: 6.8 },
      { id: "g18", name: "Programa hiperdia atualizado", target: 1, current: 0, unit: "doc", type: "DOC", risk: 6200, trend: "down", rubrica: "Metas Qualitativas", pesoFinanceiro: 9.1 },
    ],
    performance: [
      { month: "Jan", atingidas: 50, parciais: 30, naoAtingidas: 20 }, { month: "Fev", atingidas: 55, parciais: 25, naoAtingidas: 20 },
      { month: "Mar", atingidas: 58, parciais: 27, naoAtingidas: 15 }, { month: "Abr", atingidas: 62, parciais: 23, naoAtingidas: 15 },
    ],
    riskTrend: [
      { month: "Jan", risco: 32000, glosa: 5800 }, { month: "Fev", risco: 28000, glosa: 4900 },
      { month: "Mar", risco: 24000, glosa: 4200 }, { month: "Abr", risco: 21500, glosa: 3600 },
    ],
  },
];

function getReportGoalPct(g: ReportGoalItem) {
  if (g.type === "DOC") return g.current >= g.target ? 100 : 0;
  return Math.min(100, (g.current / g.target) * 100);
}

function computeReportStats(goals: ReportGoalItem[]) {
  const totalRisk = goals.reduce((s, g) => s + g.risk, 0);
  const atingidas = goals.filter(g => getReportGoalPct(g) >= 90).length;
  const parciais = goals.filter(g => { const p = getReportGoalPct(g); return p >= 60 && p < 90; }).length;
  const criticas = goals.filter(g => getReportGoalPct(g) < 60).length;
  const avg = goals.length ? Math.round(goals.reduce((s, g) => s + getReportGoalPct(g), 0) / goals.length) : 0;
  return { totalRisk, atingidas, parciais, criticas, avg, total: goals.length };
}

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

  // Report generation state
  const [selectedReportType, setSelectedReportType] = useState("");
  const [reportContractId, setReportContractId] = useState(REPORT_CONTRACTS[0].id);
  const [reportIncludeCharts, setReportIncludeCharts] = useState(true);
  const [reportIncludeDetails, setReportIncludeDetails] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

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
      case "relatorio-config": return { title: `Gerar: ${REPORT_OPTIONS.find(r => r.id === selectedReportType)?.title || ""}`, desc: "Configure e gere o relatório diretamente.", progress: 80 };
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
            } else if (r.id === "assistencial") {
              setSelectedReportType(r.id);
              goTo("relatorio-config");
            } else {
              setSelectedReportType(r.id);
              goTo("relatorio-config");
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
  const isInlineStep = ["lancar-meta-select", "lancar-meta-form", "lancar-rubrica-select", "lancar-rubrica-form", "consultar-metas-list", "treinamento", "relatorio-config", "finalizado"].includes(step);

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

  const handleGenerateReport = async () => {
    const contract = REPORT_CONTRACTS.find(c => c.id === reportContractId);
    if (!contract) return;
    const reportOption = REPORT_OPTIONS.find(r => r.id === selectedReportType);
    if (!reportOption) return;

    setGeneratingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default;

      const reportLabel = reportOption.title;
      const now = new Date().toLocaleDateString("pt-BR");
      const goals = contract.goals;
      const stats = computeReportStats(goals);

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const margin = 15;
      let y = margin;

      const PRIMARY = [35, 66, 117];
      const DARK = [30, 40, 50];
      const MUTED = [120, 130, 140];
      const RED = [220, 60, 60];
      const GREEN = [40, 160, 90];
      const AMBER = [230, 160, 30];
      const WHITE = [255, 255, 255];
      const LIGHT_BG = [235, 239, 245];

      const addNewPageIfNeeded = (needed: number) => {
        if (y + needed > H - 20) { doc.addPage(); y = margin; drawHeader(); }
      };

      const drawHeader = () => {
        doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
        doc.rect(0, 0, W, 12, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("MOSS -- Métricas para Organizações de Serviço Social", margin, 8);
        doc.text(now, W - margin, 8, { align: "right" });
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        y = 18;
      };

      const drawFooter = (pageNum: number, totalPages: number) => {
        doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
        doc.rect(0, H - 10, W, 10, "F");
        doc.setFontSize(7);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text("Gerado automaticamente pelo MOSS", margin, H - 4);
        doc.text(`Pagina ${pageNum} de ${totalPages}`, W - margin, H - 4, { align: "right" });
      };

      const drawBar = (x: number, yPos: number, w: number, h: number, pct: number, color: number[]) => {
        doc.setFillColor(230, 232, 236);
        doc.roundedRect(x, yPos, w, h, 2, 2, "F");
        const fillW = Math.max(0, (pct / 100) * w);
        if (fillW > 0) {
          doc.setFillColor(color[0], color[1], color[2]);
          doc.roundedRect(x, yPos, fillW, h, 2, 2, "F");
        }
      };

      const fmtCur = (v: number) => `R$ ${(v / 1000).toFixed(0)}k`;
      const fmtFull = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

      // Cover page
      doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
      doc.rect(0, 0, W, 45, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("MOSS", margin, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Metricas para Organizacoes de Servico Social", margin, 28);
      doc.setFontSize(9);
      doc.text(`${reportLabel}  |  ${now}`, margin, 38);
      y = 55;

      // Contract info
      doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
      doc.roundedRect(margin, y, W - 2 * margin, 18, 3, 3, "F");
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(contract.name, margin + 5, y + 7);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(`Valor global: ${fmtFull(contract.valorGlobal)}/mes  |  ${goals.length} metas avaliadas`, margin + 5, y + 14);
      y += 25;

      // KPI cards
      const cardW = (W - 2 * margin - 9) / 4;
      const kpis = [
        { label: "Risco financeiro", value: fmtCur(stats.totalRisk), color: RED, sub: `${((stats.totalRisk / contract.valorGlobal) * 100).toFixed(1)}% do contrato` },
        { label: "Atingimento medio", value: `${stats.avg}%`, color: stats.avg >= 90 ? GREEN : stats.avg >= 70 ? AMBER : RED, sub: `${stats.atingidas} de ${stats.total} atingidas` },
        { label: "Em alerta", value: `${stats.parciais}`, color: AMBER, sub: "Entre 60% e 89%" },
        { label: "Criticas", value: `${stats.criticas}`, color: RED, sub: "Abaixo de 60%" },
      ];
      kpis.forEach((kpi, i) => {
        const x = margin + i * (cardW + 3);
        doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
        doc.setDrawColor(220, 222, 226);
        doc.roundedRect(x, y, cardW, 28, 2, 2, "FD");
        doc.setFontSize(7);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(kpi.label, x + 4, y + 7);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.text(kpi.value, x + 4, y + 18);
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(kpi.sub, x + 4, y + 24);
      });
      y += 36;

      // Charts section
      if (reportIncludeCharts) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        doc.text("Distribuicao por tipo de meta", margin, y);
        y += 6;
        const qnt = goals.filter(g => g.type === "QNT").length;
        const qlt = goals.filter(g => g.type === "QLT").length;
        const docType = goals.filter(g => g.type === "DOC").length;
        const maxGoals = Math.max(qnt, qlt, docType, 1);
        const barWidth = W - 2 * margin - 35;
        [{ label: "Quantitativas", val: qnt, color: PRIMARY },
         { label: "Qualitativas", val: qlt, color: AMBER },
         { label: "Documentais", val: docType, color: MUTED }].forEach(item => {
          doc.setFontSize(7);
          doc.setTextColor(DARK[0], DARK[1], DARK[2]);
          doc.text(item.label, margin, y + 4);
          drawBar(margin + 32, y, barWidth, 5, (item.val / maxGoals) * 100, item.color);
          doc.text(`${item.val}`, margin + 34 + barWidth, y + 4);
          y += 8;
        });
        y += 4;

        // Risk bars
        addNewPageIfNeeded(60);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Top riscos financeiros", margin, y);
        y += 6;
        const topRisks = [...goals].sort((a, b) => b.risk - a.risk).slice(0, 5);
        const maxRisk = Math.max(...topRisks.map(g => g.risk), 1);
        const riskBarW = W - 2 * margin - 65;
        topRisks.forEach(g => {
          const pct = getReportGoalPct(g);
          const color = pct >= 90 ? GREEN : pct >= 60 ? AMBER : RED;
          doc.setFontSize(7);
          doc.setTextColor(DARK[0], DARK[1], DARK[2]);
          const truncName = g.name.length > 25 ? g.name.substring(0, 25) + "..." : g.name;
          doc.text(truncName, margin, y + 4);
          drawBar(margin + 52, y, riskBarW, 5, (g.risk / maxRisk) * 100, color);
          doc.setTextColor(RED[0], RED[1], RED[2]);
          doc.text(fmtCur(g.risk), margin + 54 + riskBarW, y + 4);
          y += 8;
        });
        y += 6;

        // Rubrica allocation
        addNewPageIfNeeded(55);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        doc.text("Alocacao por rubrica", margin, y);
        y += 6;
        const rubColors = [PRIMARY, GREEN, AMBER, [150, 100, 200], RED];
        contract.rubricas.forEach((r, i) => {
          const color = rubColors[i % rubColors.length];
          doc.setFontSize(7);
          doc.setTextColor(DARK[0], DARK[1], DARK[2]);
          doc.text(r.name, margin, y + 4);
          drawBar(margin + 40, y, W - 2 * margin - 65, 5, r.pct, color);
          doc.text(`${r.pct}%  (${fmtCur(r.valor)})`, W - margin - 22, y + 4);
          y += 8;
        });
        y += 4;
      }

      // Goals detail table
      if (reportIncludeDetails) {
        addNewPageIfNeeded(30);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        doc.text("Detalhamento por meta", margin, y);
        y += 4;
        const tableData = goals.map((g, i) => {
          const pct = getReportGoalPct(g).toFixed(0);
          return [`${i + 1}`, g.name, g.type, `${g.target}${g.unit}`, `${g.current}${g.unit}`, `${pct}%`, fmtCur(g.risk), `${g.pesoFinanceiro}%`];
        });
        autoTable(doc, {
          startY: y,
          head: [["#", "Meta", "Tipo", "Alvo", "Real", "Ating.", "Risco", "Peso"]],
          body: tableData,
          margin: { left: margin, right: margin },
          styles: { fontSize: 7, cellPadding: 2, lineColor: [220, 222, 226], lineWidth: 0.2 },
          headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
          alternateRowStyles: { fillColor: [248, 249, 252] },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 45 }, 2: { cellWidth: 12, halign: "center" },
            3: { cellWidth: 20, halign: "right" }, 4: { cellWidth: 20, halign: "right" }, 5: { cellWidth: 15, halign: "center" },
            6: { cellWidth: 22, halign: "right" }, 7: { cellWidth: 15, halign: "center" },
          },
          didParseCell: (data: any) => {
            if (data.section === "body" && data.column.index === 5) {
              const val = parseFloat(data.cell.raw);
              if (val >= 90) data.cell.styles.textColor = GREEN;
              else if (val >= 60) data.cell.styles.textColor = AMBER;
              else data.cell.styles.textColor = RED;
              data.cell.styles.fontStyle = "bold";
            }
          },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // Performance table
      addNewPageIfNeeded(30);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text("Evolucao mensal de desempenho", margin, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Mes", "Atingidas %", "Parciais %", "Nao atingidas %"]],
        body: contract.performance.map(p => [p.month, `${p.atingidas}%`, `${p.parciais}%`, `${p.naoAtingidas}%`]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3, lineColor: [220, 222, 226], lineWidth: 0.2 },
        headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 249, 252] },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Risk trend
      addNewPageIfNeeded(30);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Tendencia de risco e glosa", margin, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Mes", "Risco (R$)", "Glosa (R$)"]],
        body: contract.riskTrend.map(r => [r.month, fmtFull(r.risco), fmtFull(r.glosa)]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3, lineColor: [220, 222, 226], lineWidth: 0.2 },
        headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 249, 252] },
      });

      // Footers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
      }

      // Download
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fileName = `MOSS_${reportLabel.replace(/\s/g, "_")}_${contract.unit.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Relatório PDF gerado!", { description: fileName });
      setGeneratingPdf(false);
      goToFinalizado(`Relatório gerado: ${reportLabel}`, [
        `Contrato: ${contract.name}`,
        `Unidade: ${contract.unit}`,
        `Tipo: ${reportLabel}`,
        reportIncludeCharts ? "Gráficos: incluídos" : "Gráficos: não incluídos",
        reportIncludeDetails ? "Detalhamento por meta: incluído" : "Detalhamento por meta: não incluído",
        `Arquivo: ${fileName}`,
      ], "/relatorios");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Erro ao gerar PDF: " + (err instanceof Error ? err.message : String(err)));
      setGeneratingPdf(false);
    }
  };

  const renderReportConfig = () => {
    const reportOption = REPORT_OPTIONS.find(r => r.id === selectedReportType);
    if (!reportOption) return null;
    const contract = REPORT_CONTRACTS.find(c => c.id === reportContractId);
    const isAssistencial = selectedReportType === "assistencial";
    const isEvidencias = selectedReportType === "evidencias";

    const stats = contract ? computeReportStats(contract.goals) : null;

    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto space-y-5">
        {/* Report summary */}
        <div className="kpi-card p-5">
          <h3 className="font-display font-semibold text-foreground mb-1">{reportOption.title}</h3>
          <p className="text-xs text-muted-foreground">{reportOption.description}</p>
        </div>

        {/* Contract selection */}
        <div className="kpi-card p-5 space-y-3">
          <label className="text-sm font-semibold text-foreground block">Selecione o contrato</label>
          <div className="grid grid-cols-1 gap-2">
            {REPORT_CONTRACTS.map(c => {
              const cStats = computeReportStats(c.goals);
              return (
                <button key={c.id} onClick={() => setReportContractId(c.id)}
                  className={`text-left p-4 rounded-lg border transition-all ${reportContractId === c.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                  <p className="text-sm font-semibold text-foreground">{c.unit}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.goals.length} metas | Atingimento: {cStats.avg}% | Risco: R$ {(cStats.totalRisk / 1000).toFixed(0)}k
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview KPIs */}
        {contract && stats && !isAssistencial && !isEvidencias && (
          <div className="kpi-card p-5">
            <p className="text-xs font-semibold text-foreground mb-3">Prévia — {contract.unit}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold" style={{ color: stats.avg >= 90 ? "hsl(142 71% 45%)" : stats.avg >= 70 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))" }}>{stats.avg}%</p>
                <p className="text-[10px] text-muted-foreground">Atingimento médio</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-destructive">R$ {(stats.totalRisk / 1000).toFixed(0)}k</p>
                <p className="text-[10px] text-muted-foreground">Risco financeiro</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold" style={{ color: "hsl(142 71% 45%)" }}>{stats.atingidas}</p>
                <p className="text-[10px] text-muted-foreground">Metas atingidas</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-destructive">{stats.criticas}</p>
                <p className="text-[10px] text-muted-foreground">Metas críticas</p>
              </div>
            </div>
          </div>
        )}

        {/* Options */}
        {!isAssistencial && !isEvidencias && (
          <div className="kpi-card p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Opções do relatório</p>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
              <input type="checkbox" id="rpt-charts" checked={reportIncludeCharts} onChange={e => setReportIncludeCharts(e.target.checked)} className="rounded" />
              <label htmlFor="rpt-charts" className="flex-1 cursor-pointer">
                <span className="text-sm font-medium text-foreground">Incluir gráficos</span>
                <p className="text-[10px] text-muted-foreground">Distribuição por tipo, riscos e alocação por rubrica</p>
              </label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
              <input type="checkbox" id="rpt-details" checked={reportIncludeDetails} onChange={e => setReportIncludeDetails(e.target.checked)} className="rounded" />
              <label htmlFor="rpt-details" className="flex-1 cursor-pointer">
                <span className="text-sm font-medium text-foreground">Detalhamento por meta</span>
                <p className="text-[10px] text-muted-foreground">Tabela com alvo, realizado, atingimento e risco por meta</p>
              </label>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {isAssistencial ? (
            <>
              <Button className="w-full rounded-full" onClick={() => {
                goToFinalizado("Relatório Assistencial", [
                  "Abrindo o módulo de Relatório Assistencial completo.",
                  "Inclui abas: Particularidades, Compilado, Cruzamento, Relatório Final, Personalização e Aprovação.",
                ], "/relatorio-assistencial");
              }}>
                Abrir Relatório Assistencial
              </Button>
              <Button variant="outline" className="w-full rounded-full" onClick={() => goTo("relatorio-select")}>
                Escolher outro relatório
              </Button>
            </>
          ) : isEvidencias ? (
            <>
              <Button className="w-full rounded-full" onClick={() => {
                goToFinalizado("Status de Evidências", [
                  `Contrato: ${contract?.name || ""}`,
                  "Abrindo painel de evidências para consultar documentos enviados e pendentes.",
                ], "/evidencias");
              }}>
                Abrir painel de evidências
              </Button>
              <Button variant="outline" className="w-full rounded-full" onClick={() => goTo("relatorio-select")}>
                Escolher outro relatório
              </Button>
            </>
          ) : (
            <>
              <Button className="w-full rounded-full" onClick={handleGenerateReport} disabled={generatingPdf}>
                {generatingPdf ? "Gerando PDF..." : "Gerar e baixar PDF"}
              </Button>
              <Button variant="outline" className="w-full rounded-full" onClick={() => goTo("relatorio-select")}>
                Escolher outro relatório
              </Button>
            </>
          )}
        </div>
      </motion.div>
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
      const dest = finalizadoData.redirectTo || "/dashboard";
      const label = finalizadoData.title.replace("Redirecionando para ", "");
      actions.push({ label: `Ir para ${label}`, action: () => navigate(dest), variant: "default" });
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
      case "relatorio-config": return renderReportConfig();
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
            <Button variant="outline" onClick={goBack} className="text-sm rounded-full">Voltar</Button>
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
