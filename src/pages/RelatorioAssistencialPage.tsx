import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContracts } from "@/contexts/ContractsContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";

/* ══════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════ */

interface SectionDef {
  key: string;
  title: string;
  description: string;
  order: number;
  autoData?: string;
  custom?: boolean;
}

interface SectionData {
  id: string | null;
  content: string;
  attachments: Array<{ id: string; file_name: string; file_url: string; file_type: string }>;
}

interface AutoDataPayload {
  goals?: any[];
  entries?: any[];
  actionPlans?: any[];
  sauRecords?: any[];
  bedMovements?: any[];
  beds?: any[];
  rubricaEntries?: any[];
  contracts?: any[];
  sectors?: any[];
}

const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 };

/* ══════════════════════════════════════════════
   Default sections
   ══════════════════════════════════════════════ */

const DEFAULT_SECTIONS: SectionDef[] = [
  { key: "info_contrato", title: "01. Informações do Contrato", description: "Contratante, contratado, CNPJ, unidade gestora, CNES.", order: 1, autoData: "contract" },
  { key: "caract_unidade", title: "02. Caracterização da Unidade", description: "Infraestrutura, serviços terceirizados, especialidades.", order: 2, autoData: "beds" },
  { key: "implantacao_processos", title: "03. Implantação dos Processos", description: "Evolução e melhoria nos processos.", order: 3 },
  { key: "doc_regulatoria", title: "04. Documentação Regulatória", description: "Alvarás, licenças e registros profissionais.", order: 4 },
  { key: "doc_operacional", title: "05. Documentação Operacional", description: "POPs e instruções operacionais.", order: 5 },
  { key: "recursos_humanos", title: "06. Recursos Humanos", description: "Contratações, desligamentos, turnover.", order: 6 },
  { key: "seg_trabalho", title: "07. Segurança do Trabalho", description: "Acidentes e segurança ocupacional.", order: 7 },
  { key: "treinamentos", title: "08. Treinamentos", description: "Horas de treinamento e participantes.", order: 8 },
  { key: "humanizacao", title: "09. Humanização", description: "Ações de humanização e acolhimento.", order: 9 },
  { key: "producao_assistencial", title: "10. Produção Assistencial", description: "Metas por setor, atingimento e produção mensal.", order: 10, autoData: "goals" },
  { key: "indicadores_qualidade", title: "11. Indicadores de Qualidade", description: "SAU, comissões, equipe multidisciplinar.", order: 11, autoData: "sau" },
  { key: "plano_acao", title: "12. Plano de Ação", description: "Tratativas, prazos e status de ação corretiva.", order: 12, autoData: "actionPlans" },
  { key: "indicadores_acompanhamento", title: "13. Indicadores de Acompanhamento", description: "Indicadores de acompanhamento dos serviços.", order: 13 },
  { key: "tecnologia_info", title: "14. Tecnologia de Informação", description: "Sistemas, prontuário eletrônico e TI.", order: 14 },
  { key: "servicos_terceirizados", title: "15. Serviços Terceirizados", description: "Serviços terceirizados contratados.", order: 15 },
  { key: "execucao_financeira", title: "16. Execução Financeira", description: "Rubricas, faturamento e execução orçamentária.", order: 16, autoData: "rubricas" },
  { key: "eventos_campanhas", title: "17. Eventos e Campanhas", description: "Eventos e atividades realizadas.", order: 17 },
  { key: "consideracoes_finais", title: "18. Considerações Finais", description: "Conclusões e recomendações.", order: 18 },
];

const CHART_COLORS = [
  "hsl(var(--primary))", "hsl(142 71% 45%)", "hsl(38 92% 50%)",
  "hsl(280 70% 50%)", "hsl(var(--destructive))", "hsl(190 80% 45%)",
  "hsl(340 75% 55%)", "hsl(160 60% 40%)",
];

/* ══════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════ */

const RelatorioAssistencialPage = () => {
  const navigate = useNavigate();
  const { contracts } = useContracts();
  const { user } = useAuth();
  const [selectedContractId, setSelectedContractId] = useState("");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  });
  const [sections, setSections] = useState<SectionDef[]>(DEFAULT_SECTIONS);
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState(DEFAULT_SECTIONS[0].key);
  const [sectionsData, setSectionsData] = useState<Record<string, SectionData>>({});
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionDesc, setNewSectionDesc] = useState("");
  const [selectAllForPdf, setSelectAllForPdf] = useState(true);
  const [pdfSections, setPdfSections] = useState<Set<string>>(new Set(DEFAULT_SECTIONS.map(s => s.key)));

  // Auto-data state
  const [autoData, setAutoData] = useState<AutoDataPayload>({});
  const [autoDataLoading, setAutoDataLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const selectedContract = contracts.find(c => c.id === selectedContractId);
  const unit = selectedContract?.unit || "";
  const userId = user?.id || "";

  const visibleSections = useMemo(() =>
    sections.filter(s => !hiddenSections.has(s.key)),
    [sections, hiddenSections]
  );

  // Parse period for filtering
  const periodParts = useMemo(() => {
    const [m, y] = period.split("/");
    return { month: parseInt(m), year: parseInt(y), ym: `${y}-${m.padStart(2, "0")}` };
  }, [period]);

  // ─── Load auto-data from system ───
  useEffect(() => {
    if (!selectedContractId || !unit) return;
    const load = async () => {
      setAutoDataLoading(true);
      try {
        const [goalsR, entriesR, plansR, sauR, bedsR, bedMovR, rubR, sectorsR] = await Promise.all([
          supabase.from("goals").select("*").eq("facility_unit", unit as any),
          supabase.from("goal_entries").select("*"),
          supabase.from("action_plans").select("*").eq("facility_unit", unit),
          supabase.from("sau_records").select("*").eq("facility_unit", unit),
          supabase.from("beds").select("*").eq("facility_unit", unit),
          supabase.from("bed_movements").select("*").eq("facility_unit", unit),
          supabase.from("rubrica_entries").select("*").eq("facility_unit", unit),
          supabase.from("sectors").select("*").eq("facility_unit", unit),
        ]);
        setAutoData({
          goals: goalsR.data || [],
          entries: entriesR.data || [],
          actionPlans: plansR.data || [],
          sauRecords: sauR.data || [],
          beds: bedsR.data || [],
          bedMovements: bedMovR.data || [],
          rubricaEntries: rubR.data || [],
          sectors: sectorsR.data || [],
        });
      } catch (e) {
        console.error("Erro ao carregar dados:", e);
      } finally {
        setAutoDataLoading(false);
      }
    };
    load();
  }, [selectedContractId, unit]);

  // ─── Load saved sections from DB ───
  const loadSections = useCallback(async () => {
    if (!selectedContractId || !period) return;
    const { data: dbSections } = await supabase
      .from("report_sections").select("*")
      .eq("contract_id", selectedContractId).eq("period", period);
    const sectionIds = (dbSections || []).map((s: any) => s.id);
    let attachments: any[] = [];
    if (sectionIds.length > 0) {
      const { data } = await supabase.from("report_attachments").select("*").in("section_id", sectionIds);
      attachments = data || [];
    }
    const dataMap: Record<string, SectionData> = {};
    sections.forEach(sec => {
      const dbSec = (dbSections || []).find((s: any) => s.section_key === sec.key);
      dataMap[sec.key] = {
        id: dbSec?.id || null,
        content: dbSec?.content || "",
        attachments: attachments.filter((a: any) => a.section_id === dbSec?.id).map((a: any) => ({
          id: a.id, file_name: a.file_name, file_url: a.file_url, file_type: a.file_type,
        })),
      };
    });
    setSectionsData(dataMap);
  }, [selectedContractId, period, sections]);

  useEffect(() => { loadSections(); }, [loadSections]);

  // ─── Section management ───
  const addCustomSection = () => {
    if (!newSectionTitle.trim()) return;
    const order = sections.length + 1;
    const key = `custom_${Date.now()}`;
    setSections(prev => [...prev, {
      key, title: `${String(order).padStart(2, "0")}. ${newSectionTitle}`,
      description: newSectionDesc || "Seção personalizada", order, icon: <FileText className="w-3.5 h-3.5" />, custom: true,
    }]);
    setPdfSections(prev => new Set([...prev, key]));
    setNewSectionTitle("");
    setNewSectionDesc("");
    setAddSectionOpen(false);
    toast.success("Seção adicionada");
  };

  const removeSection = (key: string) => {
    setSections(prev => prev.filter(s => s.key !== key));
    setPdfSections(prev => { const n = new Set(prev); n.delete(key); return n; });
    toast.success("Seção removida");
  };

  const toggleSectionVisibility = (key: string) => {
    setHiddenSections(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  // ─── Content handlers ───
  const handleContentChange = (key: string, content: string) => {
    setSectionsData(prev => ({ ...prev, [key]: { ...prev[key], content } }));
  };

  const handleSaveSection = async (sectionKey: string) => {
    setSaving(true);
    try {
      const data = sectionsData[sectionKey];
      const sec = sections.find(s => s.key === sectionKey);
      if (!sec) return;
      if (data?.id) {
        await supabase.from("report_sections").update({ content: data.content, updated_by: userId }).eq("id", data.id);
      } else {
        await supabase.from("report_sections").insert({
          contract_id: selectedContractId, facility_unit: unit, period,
          section_key: sectionKey, section_title: sec.title, content: data?.content || "",
          sort_order: sec.order, updated_by: userId,
        });
      }
      await loadSections();
      toast.success("Seção salva");
    } catch { toast.error("Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const handleFileUpload = async (files: FileList | null, fileType: string) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const sec = sections.find(s => s.key === activeSection);
      let currentSectionId = sectionsData[activeSection]?.id;
      if (!currentSectionId && sec) {
        const { data } = await supabase.from("report_sections").insert({
          contract_id: selectedContractId, facility_unit: unit, period,
          section_key: activeSection, section_title: sec.title, content: sectionsData[activeSection]?.content || "",
          sort_order: sec.order, updated_by: userId,
        }).select("id").single();
        if (data) currentSectionId = data.id;
        await loadSections();
      }
      if (!currentSectionId) { toast.error("Erro ao criar seção"); return; }
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${selectedContractId}/${activeSection}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("report-files").upload(path, file);
        if (error) { toast.error(`Erro: ${file.name}`); continue; }
        const { data: urlData } = supabase.storage.from("report-files").getPublicUrl(path);
        await supabase.from("report_attachments").insert({
          section_id: currentSectionId, file_name: file.name, file_url: urlData.publicUrl,
          file_type: fileType, uploaded_by: userId, sort_order: 0,
        });
      }
      await loadSections();
      toast.success("Arquivo(s) enviado(s)");
    } catch { toast.error("Erro no upload"); }
    finally { setUploading(false); }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    await supabase.from("report_attachments").delete().eq("id", attachmentId);
    await loadSections();
    toast.success("Anexo removido");
  };

  // ─── Computed auto-data for sections ───
  const goalsBySector = useMemo(() => {
    if (!autoData.goals || !autoData.entries) return {};
    const map: Record<string, { name: string; target: number; current: number; pct: number }[]> = {};
    autoData.goals.forEach((g: any) => {
      const sector = g.sector || "Sem setor";
      const gEntries = autoData.entries!.filter((e: any) => {
        if (e.goal_id !== g.id) return false;
        const p = e.period as string;
        if (p.includes("/")) {
          const parts = p.split("/");
          return parts[2] === String(periodParts.year) && parts[1] === String(periodParts.month).padStart(2, "0");
        }
        return p.startsWith(periodParts.ym);
      });
      const current = gEntries.reduce((s: number, e: any) => s + Number(e.value), 0);
      if (!map[sector]) map[sector] = [];
      map[sector].push({ name: g.name, target: Number(g.target), current, pct: g.target > 0 ? Math.min(100, Math.round((current / Number(g.target)) * 100)) : 0 });
    });
    return map;
  }, [autoData.goals, autoData.entries, periodParts]);

  const goalSummary = useMemo(() => {
    const all = Object.values(goalsBySector).flat();
    const atingidas = all.filter(g => g.pct >= 90).length;
    const parciais = all.filter(g => g.pct >= 60 && g.pct < 90).length;
    const criticas = all.filter(g => g.pct < 60).length;
    const avg = all.length ? Math.round(all.reduce((s, g) => s + g.pct, 0) / all.length) : 0;
    return { total: all.length, atingidas, parciais, criticas, avg, all };
  }, [goalsBySector]);

  const actionPlanSummary = useMemo(() => {
    const plans = autoData.actionPlans || [];
    return {
      total: plans.length,
      concluidas: plans.filter((p: any) => p.status_acao === "concluida").length,
      emAndamento: plans.filter((p: any) => p.status_acao === "em_andamento").length,
      naoIniciadas: plans.filter((p: any) => p.status_acao === "nao_iniciada").length,
      canceladas: plans.filter((p: any) => p.status_acao === "cancelada").length,
      byPriority: {
        critica: plans.filter((p: any) => p.prioridade === "critica").length,
        alta: plans.filter((p: any) => p.prioridade === "alta").length,
        media: plans.filter((p: any) => p.prioridade === "media").length,
        baixa: plans.filter((p: any) => p.prioridade === "baixa").length,
      },
    };
  }, [autoData.actionPlans]);

  const sauSummary = useMemo(() => {
    const records = autoData.sauRecords || [];
    return {
      total: records.length,
      elogios: records.filter((r: any) => r.tipo === "elogio").length,
      reclamacoes: records.filter((r: any) => r.tipo === "reclamacao").length,
      sugestoes: records.filter((r: any) => r.tipo === "sugestao").length,
      ouvidoria: records.filter((r: any) => r.tipo === "ouvidoria").length,
      resolvidos: records.filter((r: any) => r.status === "resolvido").length,
    };
  }, [autoData.sauRecords]);

  const bedSummary = useMemo(() => {
    const beds = autoData.beds || [];
    return {
      totalInternacao: beds.filter((b: any) => b.category === "internacao").reduce((s: number, b: any) => s + Number(b.quantity), 0),
      totalComplementar: beds.filter((b: any) => b.category === "complementar").reduce((s: number, b: any) => s + Number(b.quantity), 0),
      total: beds.reduce((s: number, b: any) => s + Number(b.quantity), 0),
      breakdown: beds.map((b: any) => ({ specialty: b.specialty, quantity: b.quantity, category: b.category })),
    };
  }, [autoData.beds]);

  const rubricaSummary = useMemo(() => {
    const entries = (autoData.rubricaEntries || []).filter((e: any) => {
      const p = e.period as string;
      if (p.includes("/")) {
        const parts = p.split("/");
        return parts[2] === String(periodParts.year) && parts[1] === String(periodParts.month).padStart(2, "0");
      }
      return p.startsWith(periodParts.ym);
    });
    const byRubrica: Record<string, number> = {};
    entries.forEach((e: any) => {
      byRubrica[e.rubrica_name] = (byRubrica[e.rubrica_name] || 0) + Number(e.value_executed);
    });
    const totalExecuted = Object.values(byRubrica).reduce((s, v) => s + v, 0);
    return { byRubrica, totalExecuted, entries };
  }, [autoData.rubricaEntries, periodParts]);

  // ─── Section count ───
  const filledCount = useMemo(() =>
    visibleSections.filter(sec => {
      const data = sectionsData[sec.key];
      const hasAutoData = sec.autoData && (
        (sec.autoData === "goals" && goalSummary.total > 0) ||
        (sec.autoData === "actionPlans" && actionPlanSummary.total > 0) ||
        (sec.autoData === "sau" && sauSummary.total > 0) ||
        (sec.autoData === "beds" && bedSummary.total > 0) ||
        (sec.autoData === "rubricas" && rubricaSummary.totalExecuted > 0) ||
        (sec.autoData === "contract" && selectedContract)
      );
      return (data && (data.content.trim().length > 0 || data.attachments.length > 0)) || hasAutoData;
    }).length,
    [sectionsData, visibleSections, goalSummary, actionPlanSummary, sauSummary, bedSummary, rubricaSummary, selectedContract]
  );

  // ─── Render auto-data panels ───
  const renderAutoDataPanel = (sectionKey: string) => {
    const sec = sections.find(s => s.key === sectionKey);
    if (!sec?.autoData) return null;

    switch (sec.autoData) {
      case "contract":
        if (!selectedContract) return null;
        return (
          <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Dados automáticos do contrato</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-card rounded-lg p-3 border border-border">
                <p className="text-[10px] text-muted-foreground">Contrato</p>
                <p className="text-sm font-bold text-foreground">{selectedContract.name}</p>
              </div>
              <div className="bg-card rounded-lg p-3 border border-border">
                <p className="text-[10px] text-muted-foreground">Unidade</p>
                <p className="text-sm font-bold text-foreground">{unit}</p>
              </div>
              <div className="bg-card rounded-lg p-3 border border-border">
                <p className="text-[10px] text-muted-foreground">Valor mensal</p>
                <p className="text-sm font-bold text-foreground">R$ {Number(selectedContract.value).toLocaleString("pt-BR")}</p>
              </div>
              <div className="bg-card rounded-lg p-3 border border-border">
                <p className="text-[10px] text-muted-foreground">Status</p>
                <p className="text-sm font-bold text-foreground">{selectedContract.status}</p>
              </div>
            </div>
          </div>
        );

      case "goals":
        if (goalSummary.total === 0) return <p className="text-xs text-muted-foreground italic">Nenhuma meta cadastrada para esta unidade.</p>;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Dados de Produção Assistencial — {period}</span>
              <Badge variant="secondary" className="text-[10px]">{goalSummary.total} metas</Badge>
            </div>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: "Atingimento médio", value: `${goalSummary.avg}%`, color: goalSummary.avg >= 90 ? "text-emerald-600" : goalSummary.avg >= 60 ? "text-amber-500" : "text-destructive" },
                { label: "Atingidas (≥90%)", value: goalSummary.atingidas, color: "text-emerald-600" },
                { label: "Parciais (60-89%)", value: goalSummary.parciais, color: "text-amber-500" },
                { label: "Críticas (<60%)", value: goalSummary.criticas, color: "text-destructive" },
                { label: "Total metas", value: goalSummary.total, color: "text-foreground" },
              ].map((kpi, i) => (
                <div key={i} className="bg-card rounded-lg p-3 border border-border text-center">
                  <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                  <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>
            {/* Chart: Atingimento por setor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Atingimento por Meta</p>
                <ResponsiveContainer width="100%" height={Math.max(200, goalSummary.all.length * 24)}>
                  <BarChart data={[...goalSummary.all].sort((a, b) => (b.current > 0 ? 1 : 0) - (a.current > 0 ? 1 : 0) || b.pct - a.pct).map(g => ({ name: g.name.length > 22 ? g.name.slice(0, 22) + "…" : g.name, pct: g.pct }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" domain={[0, 110]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="pct" radius={[0, 4, 4, 0]} name="Atingimento">
                      {[...goalSummary.all].sort((a, b) => (b.current > 0 ? 1 : 0) - (a.current > 0 ? 1 : 0) || b.pct - a.pct).map((g, i) => (
                        <Cell key={i} fill={g.pct >= 90 ? "hsl(142 71% 45%)" : g.pct >= 60 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Distribuição por Status</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={[
                      { name: "Atingidas", value: goalSummary.atingidas, fill: "hsl(142 71% 45%)" },
                      { name: "Parciais", value: goalSummary.parciais, fill: "hsl(38 92% 50%)" },
                      { name: "Críticas", value: goalSummary.criticas, fill: "hsl(var(--destructive))" },
                    ].filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                      {[
                        { fill: "hsl(142 71% 45%)" }, { fill: "hsl(38 92% 50%)" }, { fill: "hsl(var(--destructive))" },
                      ].filter((_, i) => [goalSummary.atingidas, goalSummary.parciais, goalSummary.criticas][i] > 0).map((c, i) => (
                        <Cell key={i} fill={c.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Per-sector breakdown */}
            <Accordion type="multiple" className="w-full">
              {Object.entries(goalsBySector).map(([sector, goals]) => (
                <AccordionItem key={sector} value={sector} className="border border-border rounded-lg mb-2 overflow-hidden">
                  <AccordionTrigger className="px-4 py-2 text-sm font-semibold hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span>{sector}</span>
                      <Badge variant="outline" className="text-[10px]">{goals.length} metas</Badge>
                      <Badge className="text-[10px]" variant={goals.every(g => g.pct >= 90) ? "default" : "destructive"}>
                        {Math.round(goals.reduce((s, g) => s + g.pct, 0) / goals.length)}% médio
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <div className="space-y-2">
                      {goals.sort((a, b) => b.pct - a.pct).map((g, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-foreground w-48 truncate">{g.name}</span>
                          <div className="flex-1">
                            <Progress value={g.pct} className="h-2" />
                          </div>
                          <span className={`text-xs font-semibold w-12 text-right ${g.pct >= 90 ? "text-emerald-600" : g.pct >= 60 ? "text-amber-500" : "text-destructive"}`}>{g.pct}%</span>
                          <span className="text-[10px] text-muted-foreground w-24 text-right">{g.current}/{g.target}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        );

      case "actionPlans":
        if (actionPlanSummary.total === 0) return <p className="text-xs text-muted-foreground italic">Nenhum plano de ação registrado.</p>;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Plano de Ação — Dados do sistema</span>
              <Badge variant="secondary" className="text-[10px]">{actionPlanSummary.total} tratativas</Badge>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: "Total", value: actionPlanSummary.total, color: "text-foreground" },
                { label: "Concluídas", value: actionPlanSummary.concluidas, color: "text-emerald-600" },
                { label: "Em andamento", value: actionPlanSummary.emAndamento, color: "text-amber-500" },
                { label: "Não iniciadas", value: actionPlanSummary.naoIniciadas, color: "text-destructive" },
                { label: "Canceladas", value: actionPlanSummary.canceladas, color: "text-muted-foreground" },
              ].map((kpi, i) => (
                <div key={i} className="bg-card rounded-lg p-3 border border-border text-center">
                  <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                  <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Status das Tratativas</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={[
                      { name: "Concluídas", value: actionPlanSummary.concluidas },
                      { name: "Em andamento", value: actionPlanSummary.emAndamento },
                      { name: "Não iniciadas", value: actionPlanSummary.naoIniciadas },
                      { name: "Canceladas", value: actionPlanSummary.canceladas },
                    ].filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3}>
                      {[
                        { fill: "hsl(142 71% 45%)" }, { fill: "hsl(38 92% 50%)" },
                        { fill: "hsl(var(--destructive))" }, { fill: "hsl(var(--muted-foreground))" },
                      ].filter((_, i) => [actionPlanSummary.concluidas, actionPlanSummary.emAndamento, actionPlanSummary.naoIniciadas, actionPlanSummary.canceladas][i] > 0).map((c, i) => (
                        <Cell key={i} fill={c.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Por Prioridade</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={[
                    { name: "Crítica", value: actionPlanSummary.byPriority.critica },
                    { name: "Alta", value: actionPlanSummary.byPriority.alta },
                    { name: "Média", value: actionPlanSummary.byPriority.media },
                    { name: "Baixa", value: actionPlanSummary.byPriority.baixa },
                  ].filter(d => d.value > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Tratativas">
                      {[
                        { fill: "hsl(var(--destructive))" }, { fill: "hsl(38 92% 50%)" },
                        { fill: "hsl(var(--primary))" }, { fill: "hsl(142 71% 45%)" },
                      ].filter((_, i) => [actionPlanSummary.byPriority.critica, actionPlanSummary.byPriority.alta, actionPlanSummary.byPriority.media, actionPlanSummary.byPriority.baixa][i] > 0).map((c, i) => (
                        <Cell key={i} fill={c.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      case "sau":
        if (sauSummary.total === 0) return <p className="text-xs text-muted-foreground italic">Nenhum registro SAU.</p>;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">SAU — Serviço de Atendimento ao Usuário</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {[
                { label: "Total", value: sauSummary.total, color: "text-foreground" },
                { label: "Elogios", value: sauSummary.elogios, color: "text-emerald-600" },
                { label: "Reclamações", value: sauSummary.reclamacoes, color: "text-destructive" },
                { label: "Sugestões", value: sauSummary.sugestoes, color: "text-amber-500" },
                { label: "Ouvidoria", value: sauSummary.ouvidoria, color: "text-primary" },
                { label: "Resolvidos", value: sauSummary.resolvidos, color: "text-emerald-600" },
              ].map((kpi, i) => (
                <div key={i} className="bg-card rounded-lg p-3 border border-border text-center">
                  <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                  <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={[
                  { name: "Elogios", value: sauSummary.elogios },
                  { name: "Reclamações", value: sauSummary.reclamacoes },
                  { name: "Sugestões", value: sauSummary.sugestoes },
                  { name: "Ouvidoria", value: sauSummary.ouvidoria },
                ].filter(d => d.value > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {["hsl(142 71% 45%)", "hsl(var(--destructive))", "hsl(38 92% 50%)", "hsl(var(--primary))"].map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case "beds":
        if (bedSummary.total === 0) return <p className="text-xs text-muted-foreground italic">Nenhum leito cadastrado.</p>;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Capacidade de Leitos — {unit}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card rounded-lg p-3 border border-border text-center">
                <p className="text-[10px] text-muted-foreground">Internação</p>
                <p className="text-lg font-bold text-primary">{bedSummary.totalInternacao}</p>
              </div>
              <div className="bg-card rounded-lg p-3 border border-border text-center">
                <p className="text-[10px] text-muted-foreground">Complementar</p>
                <p className="text-lg font-bold" style={{ color: "hsl(38 92% 50%)" }}>{bedSummary.totalComplementar}</p>
              </div>
              <div className="bg-card rounded-lg p-3 border border-border text-center">
                <p className="text-[10px] text-muted-foreground">Total</p>
                <p className="text-lg font-bold text-foreground">{bedSummary.total}</p>
              </div>
            </div>
            {bedSummary.breakdown.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Distribuição por Especialidade</p>
                <ResponsiveContainer width="100%" height={Math.max(120, bedSummary.breakdown.length * 24)}>
                  <BarChart data={bedSummary.breakdown.map((b: any) => ({ name: b.specialty.length > 20 ? b.specialty.slice(0, 20) + "…" : b.specialty, leitos: b.quantity }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="leitos" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Leitos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );

      case "rubricas":
        if (rubricaSummary.totalExecuted === 0) return <p className="text-xs text-muted-foreground italic">Nenhum lançamento de rubrica no período.</p>;
        const rubData = Object.entries(rubricaSummary.byRubrica).map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, valor: value }));
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Execução Financeira — {period}</span>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border text-center">
              <p className="text-[10px] text-muted-foreground">Total Executado</p>
              <p className="text-xl font-bold text-foreground">R$ {rubricaSummary.totalExecuted.toLocaleString("pt-BR")}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <ResponsiveContainer width="100%" height={Math.max(120, rubData.length * 30)}>
                <BarChart data={rubData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Executado" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      default: return null;
    }
  };

  // ─── PDF Generation ───
  const handleExportPdf = async () => {
    if (!selectedContract) return;
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const PRIMARY: [number, number, number] = [30, 58, 95];
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const margin = 14;

      const drawHeader = () => {
        doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
        doc.rect(0, 0, W, 12, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("MOSS — Relatório Assistencial", margin, 8);
        doc.text(period, W - margin, 8, { align: "right" });
        doc.setTextColor(0);
      };

      // Cover
      doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
      doc.rect(0, 0, W, 55, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO ASSISTENCIAL", W / 2, 22, { align: "center" });
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Gerência, Operacionalização e Execução das Ações e Serviços de Saúde", W / 2, 32, { align: "center" });
      doc.setFontSize(9);
      doc.text(`${selectedContract.name} — ${unit}`, W / 2, 42, { align: "center" });
      doc.text(`Período: ${period}`, W / 2, 50, { align: "center" });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, W / 2, 70, { align: "center" });

      // Summary
      if (goalSummary.total > 0) {
        let y = 85;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
        doc.text("Resumo do Período", margin, y); y += 8;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(`${goalSummary.total} metas avaliadas | Atingimento médio: ${goalSummary.avg}%`, margin, y); y += 5;
        doc.text(`Atingidas: ${goalSummary.atingidas} | Parciais: ${goalSummary.parciais} | Críticas: ${goalSummary.criticas}`, margin, y); y += 5;
        if (actionPlanSummary.total > 0) {
          doc.text(`${actionPlanSummary.total} planos de ação | ${actionPlanSummary.concluidas} concluídos | ${actionPlanSummary.emAndamento} em andamento`, margin, y);
        }
      }

      // TOC
      doc.addPage();
      drawHeader();
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
      doc.text("SUMÁRIO", margin, 22);
      let ty = 30;
      doc.setTextColor(0);
      const pdfVisibleSections = visibleSections.filter(s => pdfSections.has(s.key));
      pdfVisibleSections.forEach(sec => {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(sec.title, margin, ty);
        ty += 6;
        if (ty > 280) { doc.addPage(); drawHeader(); ty = 20; }
      });

      // Content pages
      pdfVisibleSections.forEach(sec => {
        doc.addPage();
        drawHeader();

        // Section title bar
        doc.setFillColor(235, 239, 245);
        doc.roundedRect(margin, 16, W - 2 * margin, 10, 2, 2, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
        doc.text(sec.title, margin + 4, 23);
        doc.setTextColor(0);
        let y = 32;

        // Auto-data summary text
        if (sec.autoData === "goals" && goalSummary.total > 0) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(80, 80, 80);
          doc.text(`Total de metas: ${goalSummary.total} | Atingimento médio: ${goalSummary.avg}% | Atingidas: ${goalSummary.atingidas} | Parciais: ${goalSummary.parciais} | Críticas: ${goalSummary.criticas}`, margin, y);
          y += 8;

          // Goals table
          autoTable(doc, {
            startY: y,
            head: [["Meta", "Setor", "Alvo", "Realizado", "Ating."]],
            body: goalSummary.all.sort((a, b) => (b.current > 0 ? 1 : 0) - (a.current > 0 ? 1 : 0) || b.pct - a.pct).map(g => [g.name, "", `${g.target}`, `${g.current}`, `${g.pct}%`]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248, 249, 252] },
            didParseCell: (data: any) => {
              if (data.section === "body" && data.column.index === 4) {
                const val = parseFloat(data.cell.raw);
                if (val >= 90) data.cell.styles.textColor = [40, 160, 90];
                else if (val >= 60) data.cell.styles.textColor = [230, 160, 30];
                else data.cell.styles.textColor = [220, 60, 60];
                data.cell.styles.fontStyle = "bold";
              }
            },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (sec.autoData === "actionPlans" && actionPlanSummary.total > 0) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.text(`Total: ${actionPlanSummary.total} | Concluídas: ${actionPlanSummary.concluidas} | Em andamento: ${actionPlanSummary.emAndamento} | Não iniciadas: ${actionPlanSummary.naoIniciadas}`, margin, y);
          y += 8;

          autoTable(doc, {
            startY: y,
            head: [["Referência", "Prioridade", "Status", "Responsável", "Prazo"]],
            body: (autoData.actionPlans || []).map((p: any) => [
              p.reference_name, p.prioridade, p.status_acao.replace("_", " "),
              p.responsavel || "—", p.prazo || "—",
            ]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248, 249, 252] },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (sec.autoData === "sau" && sauSummary.total > 0) {
          doc.setFontSize(8);
          doc.text(`Total: ${sauSummary.total} | Elogios: ${sauSummary.elogios} | Reclamações: ${sauSummary.reclamacoes} | Sugestões: ${sauSummary.sugestoes} | Resolvidos: ${sauSummary.resolvidos}`, margin, y);
          y += 6;
        }

        if (sec.autoData === "beds" && bedSummary.total > 0) {
          doc.setFontSize(8);
          doc.text(`Total de leitos: ${bedSummary.total} | Internação: ${bedSummary.totalInternacao} | Complementar: ${bedSummary.totalComplementar}`, margin, y);
          y += 8;
          autoTable(doc, {
            startY: y,
            head: [["Especialidade", "Categoria", "Quantidade"]],
            body: bedSummary.breakdown.map((b: any) => [b.specialty, b.category, b.quantity]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248, 249, 252] },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (sec.autoData === "rubricas" && rubricaSummary.totalExecuted > 0) {
          doc.setFontSize(8);
          doc.text(`Total executado: R$ ${rubricaSummary.totalExecuted.toLocaleString("pt-BR")}`, margin, y);
          y += 8;
          autoTable(doc, {
            startY: y,
            head: [["Rubrica", "Valor Executado"]],
            body: Object.entries(rubricaSummary.byRubrica).map(([name, value]) => [name, `R$ ${value.toLocaleString("pt-BR")}`]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248, 249, 252] },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        // User-entered content
        const data = sectionsData[sec.key];
        if (data?.content?.trim()) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0);
          const lines = doc.splitTextToSize(data.content, W - 2 * margin);
          for (const line of lines) {
            if (y > 275) { doc.addPage(); drawHeader(); y = 20; }
            doc.text(line, margin, y);
            y += 4.5;
          }
        }

        if (data?.attachments?.length) {
          y += 4;
          if (y > 270) { doc.addPage(); drawHeader(); y = 20; }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text("Anexos:", margin, y);
          doc.setFont("helvetica", "normal");
          y += 5;
          data.attachments.forEach(att => {
            if (y > 280) { doc.addPage(); drawHeader(); y = 20; }
            doc.setFontSize(8);
            doc.text(`• ${att.file_name}`, margin + 4, y);
            y += 4;
          });
        }

        if (!data?.content?.trim() && !sec.autoData) {
          doc.setFontSize(9);
          doc.setTextColor(150);
          doc.text("Seção não preenchida.", margin, y);
          doc.setTextColor(0);
        }
      });

      // Page footers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`MOSS — ${selectedContract.name} — ${period} — Página ${i}/${pageCount}`, margin, H - 6);
      }

      doc.save(`relatorio_assistencial_${unit.replace(/\s/g, "_")}_${period.replace("/", "-")}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    } finally { setGenerating(false); }
  };

  const activeSec = sections.find(s => s.key === activeSection);
  const activeData = sectionsData[activeSection] || { id: null, content: "", attachments: [] };
  const activeImages = activeData.attachments.filter(a => a.file_type === "image");
  const activeFiles = activeData.attachments.filter(a => a.file_type !== "image");

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          Voltar
        </Button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Relatório Assistencial
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Compilador inteligente — preencha, revise os dados automáticos e gere o PDF final
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32">
              <Label className="text-[10px] text-muted-foreground">Período</Label>
              <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="MM/AAAA" className="h-9 text-sm" />
            </div>
            <div className="w-64">
              <Label className="text-[10px] text-muted-foreground">Contrato</Label>
              <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {!selectedContract ? (
          <div className="kpi-card p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Selecione um contrato para montar o relatório assistencial.</p>
          </div>
        ) : (
          <div className="flex gap-5">
            {/* ─── Sidebar ─── */}
            <div className="w-72 shrink-0">
              <div className="bg-card rounded-xl border border-border p-3 sticky top-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-foreground">Sumário</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{filledCount}/{visibleSections.length}</Badge>
                    <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Plus className="w-3.5 h-3.5" /></Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Adicionar Seção</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Título</Label>
                            <Input value={newSectionTitle} onChange={e => setNewSectionTitle(e.target.value)} placeholder="Ex: Gestão de Resíduos" className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">Descrição (opcional)</Label>
                            <Input value={newSectionDesc} onChange={e => setNewSectionDesc(e.target.value)} placeholder="Breve descrição" className="mt-1" />
                          </div>
                          <DialogClose asChild>
                            <Button onClick={addCustomSection} className="w-full">Adicionar ao Sumário</Button>
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <ScrollArea className="h-[calc(100vh-360px)]">
                  <div className="space-y-0.5 pr-2">
                    {sections.map(sec => {
                      const data = sectionsData[sec.key];
                      const hidden = hiddenSections.has(sec.key);
                      const hasSavedContent = data && (data.content.trim().length > 0 || data.attachments.length > 0);
                      const hasAuto = sec.autoData && (
                        (sec.autoData === "goals" && goalSummary.total > 0) ||
                        (sec.autoData === "actionPlans" && actionPlanSummary.total > 0) ||
                        (sec.autoData === "sau" && sauSummary.total > 0) ||
                        (sec.autoData === "beds" && bedSummary.total > 0) ||
                        (sec.autoData === "rubricas" && rubricaSummary.totalExecuted > 0) ||
                        (sec.autoData === "contract" && selectedContract)
                      );
                      const filled = hasSavedContent || hasAuto;
                      const isActive = activeSection === sec.key;
                      return (
                        <button
                          key={sec.key}
                          onClick={() => setActiveSection(sec.key)}
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] transition-all flex items-center gap-2 group ${
                            hidden ? "opacity-40" :
                            isActive ? "bg-primary text-primary-foreground font-medium shadow-sm" :
                            "hover:bg-muted text-foreground"
                          }`}
                        >
                          <span className={`shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`}>
                            {sec.icon}
                          </span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            filled && hasAuto ? "bg-emerald-500 ring-1 ring-emerald-500/30" :
                            filled ? "bg-emerald-500" :
                            isActive ? "bg-primary-foreground/40" : "bg-muted-foreground/20"
                          }`} />
                          <span className="truncate flex-1">{sec.title}</span>
                          {hasAuto && !isActive && (
                            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* PDF export */}
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        <Settings className="w-3 h-3 mr-1" /> Configurar PDF
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
                      <DialogHeader>
                        <DialogTitle>Seções do PDF</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-3">
                          <Checkbox
                            checked={selectAllForPdf}
                            onCheckedChange={checked => {
                              setSelectAllForPdf(!!checked);
                              setPdfSections(checked ? new Set(sections.map(s => s.key)) : new Set());
                            }}
                          />
                          <span className="text-xs font-medium">Selecionar todas</span>
                        </div>
                        {sections.map(sec => (
                          <div key={sec.key} className="flex items-center gap-2 py-1">
                            <Checkbox
                              checked={pdfSections.has(sec.key)}
                              onCheckedChange={checked => {
                                setPdfSections(prev => {
                                  const n = new Set(prev);
                                  checked ? n.add(sec.key) : n.delete(sec.key);
                                  return n;
                                });
                              }}
                            />
                            <span className="text-xs">{sec.title}</span>
                            {sec.custom && (
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-auto text-destructive" onClick={() => removeSection(sec.key)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button onClick={handleExportPdf} disabled={generating} className="w-full" size="sm">
                    <Download className="w-3.5 h-3.5 mr-1" />
                    {generating ? "Gerando PDF..." : "Gerar PDF do Relatório"}
                  </Button>
                </div>
              </div>
            </div>

            {/* ─── Content area ─── */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="bg-card rounded-xl border border-border shadow-sm"
                >
                  {/* Section header */}
                  <div className="p-5 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          {activeSec?.icon}
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-foreground">{activeSec?.title}</h2>
                          <p className="text-xs text-muted-foreground">{activeSec?.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeSec?.autoData && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            Dados automáticos
                          </Badge>
                        )}
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSaveSection(activeSection)} disabled={saving}>
                          <Save className="w-3 h-3 mr-1" />
                          {saving ? "Salvando..." : "Salvar"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Auto-data panel */}
                    {activeSec?.autoData && (
                      <div className="rounded-xl bg-secondary/20 border border-primary/10 p-4">
                        {autoDataLoading ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            Carregando dados do sistema...
                          </div>
                        ) : renderAutoDataPanel(activeSection)}
                      </div>
                    )}

                    {/* Content editor */}
                    <div>
                      <Label className="text-xs font-semibold mb-2 block flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Conteúdo Textual
                      </Label>
                      <Textarea
                        value={activeData.content}
                        onChange={e => handleContentChange(activeSection, e.target.value)}
                        placeholder={`Adicione informações complementares para "${activeSec?.title}"...`}
                        rows={8}
                        className="text-sm"
                      />
                    </div>

                    {/* Media */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Images */}
                      <div>
                        <Label className="text-xs font-semibold mb-2 block flex items-center gap-1">
                          <Image className="w-3 h-3" /> Imagens
                        </Label>
                        {activeImages.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            {activeImages.map(img => (
                              <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border">
                                <img src={img.file_url} alt={img.file_name} className="w-full h-24 object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Button variant="destructive" size="sm" className="text-[10px] h-6" onClick={() => handleDeleteAttachment(img.id)}>Remover</Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileUpload(e.target.files, "image")} />
                        <Button variant="outline" size="sm" className="text-xs w-full" onClick={() => imageInputRef.current?.click()} disabled={uploading}>
                          <Image className="w-3 h-3 mr-1" /> {uploading ? "Enviando..." : "Inserir imagens"}
                        </Button>
                      </div>
                      {/* Files */}
                      <div>
                        <Label className="text-xs font-semibold mb-2 block flex items-center gap-1">
                          <Paperclip className="w-3 h-3" /> Anexos (PDF, Excel, etc.)
                        </Label>
                        {activeFiles.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {activeFiles.map(file => (
                              <div key={file.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 text-xs">
                                <a href={file.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex-1">
                                  📎 {file.file_name}
                                </a>
                                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-destructive" onClick={() => handleDeleteAttachment(file.id)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.doc,.docx,.csv" multiple className="hidden" onChange={e => handleFileUpload(e.target.files, "document")} />
                        <Button variant="outline" size="sm" className="text-xs w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                          <Paperclip className="w-3 h-3 mr-1" /> {uploading ? "Enviando..." : "Inserir anexo"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default RelatorioAssistencialPage;
