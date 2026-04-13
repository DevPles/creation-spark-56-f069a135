import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// no icon imports - text only
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useContracts } from "@/contexts/ContractsContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
  "#2563eb",
  "#16a34a",
  "#f59e0b",
];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const RelatorioAssistencialPage = () => {
  const navigate = useNavigate();
  const { contracts } = useContracts();
  const [selectedContractId, setSelectedContractId] = useState("");
  const [editableNotes, setEditableNotes] = useState("");
  const [dbGoals, setDbGoals] = useState<any[]>([]);
  const [dbEntries, setDbEntries] = useState<any[]>([]);
  const [dbRubricaEntries, setDbRubricaEntries] = useState<any[]>([]);

  // Personalização state — editable sections
  const [persContrato, setPersContrato] = useState("");
  const [persRubricas, setPersRubricas] = useState("");
  const [persQualitativas, setPersQualitativas] = useState("");
  const [persQuantitativas, setPersQuantitativas] = useState("");
  const [persPenalidades, setPersPenalidades] = useState("");
  const [persEvidencias, setPersEvidencias] = useState("");
  const [persInitialized, setPersInitialized] = useState("");
  const [sectionImages, setSectionImages] = useState<Record<string, string[]>>({});
  const [pontosMelhoria, setPontosMelhoria] = useState<string[]>([]);
  const [novoPonto, setNovoPonto] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  // Timeline items for Relatório Final
  interface TimelineItem {
    id: string;
    title: string;
    category: "acao_promocao" | "justificativa" | "meta" | "rubrica";
    date: string;
    description: string;
    status: "pendente" | "aprovado" | "rejeitado";
    fileName?: string;
  }

  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([
    { id: "tl1", title: "Campanha de vacinação sazonal", category: "acao_promocao", date: "2024-03-15", description: "Realizada campanha de vacinação contra gripe com 320 doses aplicadas na unidade.", status: "aprovado", fileName: "relatorio_vacinacao.pdf" },
    { id: "tl2", title: "Justificativa: tempo de espera elevado", category: "justificativa", date: "2024-03-10", description: "Aumento no tempo de espera devido a reforma na ala B, reduzindo capacidade operacional em 30%.", status: "pendente" },
    { id: "tl3", title: "Palestra sobre higienização", category: "acao_promocao", date: "2024-02-28", description: "Treinamento sobre protocolo de higienização de mãos com 45 participantes.", status: "aprovado", fileName: "lista_presenca_higiene.pdf" },
    { id: "tl4", title: "Justificativa: rubrica RH estourada", category: "rubrica", date: "2024-02-20", description: "Contratação emergencial de 3 enfermeiros devido a afastamentos por COVID.", status: "rejeitado" },
    { id: "tl5", title: "Mutirão cirúrgico", category: "acao_promocao", date: "2024-02-10", description: "Mutirão de cirurgias eletivas: 28 procedimentos realizados em 3 dias.", status: "pendente", fileName: "relatorio_mutirao.pdf" },
    { id: "tl6", title: "Meta NPS: pesquisa de satisfação", category: "meta", date: "2024-01-30", description: "Aplicação de pesquisa NPS com 180 pacientes. Resultado: 72 pontos.", status: "aprovado", fileName: "pesquisa_nps_q1.xlsx" },
  ]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const categoryLabels: Record<string, { label: string; color: string }> = {
    acao_promocao: { label: "Ação de Promoção", color: "bg-primary/10 text-primary" },
    justificativa: { label: "Justificativa", color: "bg-yellow-500/10 text-yellow-600" },
    meta: { label: "Evidência de Meta", color: "bg-emerald-500/10 text-emerald-600" },
    rubrica: { label: "Rubrica Estourada", color: "bg-destructive/10 text-destructive" },
  };

  const selectedContract = contracts.find((c) => c.id === selectedContractId);
  const unit = selectedContract?.unit || "";

  // Load goals and entries from DB
  useEffect(() => {
    if (!unit) return;
    const load = async () => {
      const [goalsRes, entriesRes, rubRes] = await Promise.all([
        supabase.from("goals").select("*").eq("facility_unit", unit as any),
        supabase.from("goal_entries").select("*"),
        supabase.from("rubrica_entries").select("*").eq("facility_unit", unit),
      ]);
      setDbGoals(goalsRes.data || []);
      setDbEntries(entriesRes.data || []);
      setDbRubricaEntries(rubRes.data || []);
    };
    load();
  }, [unit]);

  const goals = useMemo(() => {
    return dbGoals.map(g => {
      const entries = dbEntries.filter(e => e.goal_id === g.id);
      const achieved = entries.reduce((s: number, e: any) => s + Number(e.value), 0);
      return {
        name: g.name,
        type: g.type as "QLT" | "QNT",
        target: Number(g.target),
        achieved,
        weight: Number(g.weight) * 100,
        penalty: Number(g.risk) > 0 ? Number(g.risk) / (selectedContract?.value || 1) * 100 : 0,
      };
    });
  }, [dbGoals, dbEntries, selectedContract]);

  const qualitativas = useMemo(() => goals.filter(g => g.type === "QLT"), [goals]);
  const quantitativas = useMemo(() => goals.filter(g => g.type === "QNT"), [goals]);

  const estouradas = useMemo(() => {
    if (!selectedContract) return [];
    return (selectedContract.rubricas || []).filter(r => r.percent > 0).map(r => {
      const allocated = selectedContract.value * (r.percent / 100);
      const executed = dbRubricaEntries.filter(e => e.rubrica_name === r.name).reduce((s: number, e: any) => s + Number(e.value_executed), 0);
      return { rubrica: r.name, unit, contract: selectedContract.name, pctExec: allocated > 0 ? Math.round((executed / allocated) * 100) : 0, allocated, executed, excedente: executed - allocated };
    }).filter(e => e.executed > e.allocated);
  }, [selectedContract, dbRubricaEntries, unit]);

  const monthlyTrendData = useMemo(() => {
    return MONTHS.map((month, i) => {
      const monthEntries = dbRubricaEntries.filter(e => {
        try { const parts = e.period.split("/"); return parts.length === 3 && parseInt(parts[1]) - 1 === i; } catch { return false; }
      });
      const executed = monthEntries.reduce((s: number, e: any) => s + Number(e.value_executed), 0);
      const allocated = selectedContract ? selectedContract.value / 12 : 0;
      return { month, alocado: Math.round(allocated / 1000), executado: Math.round(executed / 1000) };
    });
  }, [dbRubricaEntries, selectedContract]);

  const totalPenalty = useMemo(() => {
    return goals.reduce((sum, g) => {
      const pct = g.target > 0 ? (g.achieved / g.target) * 100 : 0;
      return sum + (pct < 100 ? g.penalty : 0);
    }, 0);
  }, [goals]);

  const totalGlosa = useMemo(() => {
    if (!selectedContract) return 0;
    return selectedContract.value * selectedContract.variable * (totalPenalty / 100);
  }, [selectedContract, totalPenalty]);

  const goalAchievementPct = useMemo(() => {
    if (goals.length === 0) return 0;
    const weightedSum = goals.reduce((sum, g) => {
      const pct = Math.min(100, g.target > 0 ? (g.achieved / g.target) * 100 : 0);
      return sum + pct * (g.weight / 100);
    }, 0);
    return Math.round(weightedSum);
  }, [goals]);

  const goalsBarData = useMemo(() =>
    goals.map(g => ({
      name: g.name.length > 20 ? g.name.substring(0, 20) + "..." : g.name,
      fullName: g.name,
      meta: g.target,
      realizado: g.achieved,
      tipo: g.type,
    })),
  [goals]);

  const rubricaPieData = useMemo(() =>
    (selectedContract?.rubricas || []).map(r => ({
      name: r.name,
      value: r.percent,
    })),
  [selectedContract]);

  const radarData = useMemo(() => goals.map(g => ({
      subject: g.name.length > 15 ? g.name.substring(0, 15) + "..." : g.name,
      alcance: Math.min(100, g.target > 0 ? Math.round((g.achieved / g.target) * 100) : 0),
      peso: g.weight,
    })),
  [goals]);

  const crossAnalysisData = useMemo(() => {
    if (!selectedContract) return [];
    return goals.map(g => {
      const pct = g.target > 0 ? Math.min(100, Math.round((g.achieved / g.target) * 100)) : 0;
      const penaltyApplied = pct < 100 ? g.penalty : 0;
      const glosaValue = selectedContract.value * selectedContract.variable * (penaltyApplied / 100);
      return {
        meta: g.name,
        tipo: g.type,
        target: g.target,
        achieved: g.achieved,
        pct,
        peso: g.weight,
        penalidade: penaltyApplied,
        glosa: glosaValue,
        status: pct >= 100 ? "Atingida" : pct >= 80 ? "Parcial" : "Crítica",
      };
    });
  }, [goals, selectedContract]);

  const handleExportPdf = () => {
    if (!selectedContract) return;
    const doc = new jsPDF();
    const primary: [number, number, number] = [30, 58, 95];

    // Header
    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Moss — Relatório Assistencial", 14, 18);
    doc.setFontSize(9);
    doc.text(selectedContract.name, 14, 25);

    let y = 40;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text("Resumo Geral", 14, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [["Indicador", "Valor"]],
      body: [
        ["Valor do contrato", `R$ ${(selectedContract.value / 1e6).toFixed(1)}M`],
        ["Parte variável", `${(selectedContract.variable * 100).toFixed(0)}%`],
        ["Alcance ponderado", `${goalAchievementPct}%`],
        ["Penalidade acumulada", `${totalPenalty.toFixed(1)}%`],
        ["Glosa estimada", `R$ ${(totalGlosa / 1000).toFixed(0)}k`],
        ["Metas qualitativas", `${qualitativas.length}`],
        ["Metas quantitativas", `${quantitativas.length}`],
        ["Rubricas estouradas", `${estouradas.length}`],
      ],
      headStyles: { fillColor: primary },
      styles: { fontSize: 9 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(12);
    doc.text("Detalhamento de Metas", 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Meta", "Tipo", "Meta", "Realizado", "%", "Peso", "Penalidade", "Status"]],
      body: crossAnalysisData.map(r => [
        r.meta, r.tipo, String(r.target), String(r.achieved), `${r.pct}%`, `${r.peso}%`, `${r.penalidade}%`, r.status,
      ]),
      headStyles: { fillColor: primary },
      styles: { fontSize: 7 },
      columnStyles: { 0: { cellWidth: 40 } },
    });

    if (estouradas.length > 0) {
      y = (doc as any).lastAutoTable.finalY + 12;
      doc.text("Rubricas Estouradas", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Rubrica", "Alocado", "Executado", "Excedente", "% Exec"]],
        body: estouradas.map(e => [
          e.rubrica,
          `R$ ${(e.allocated / 1000).toFixed(0)}k`,
          `R$ ${(e.executed / 1000).toFixed(0)}k`,
          `R$ ${(e.excedente / 1000).toFixed(0)}k`,
          `${e.pctExec}%`,
        ]),
        headStyles: { fillColor: [180, 40, 40] },
        styles: { fontSize: 8 },
      });
    }

    if (editableNotes.trim()) {
      y = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.text("Observações do Analista", 14, y);
      y += 6;
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(editableNotes, 180);
      doc.text(lines, 14, y);
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Moss — Relatório gerado em ${new Date().toLocaleDateString("pt-BR")} — Página ${i}/${pageCount}`, 14, 290);
    }

    doc.save(`relatorio_assistencial_${unit.replace(/\s/g, "_")}.pdf`);
    toast.success("Relatório exportado com sucesso");
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          Voltar
        </Button>

        <PageHeader
          title="Relatório Assistencial"
          subtitle="Análise de metas, penalizações e desempenho contratual"
          action={
            <div className="w-64">
              <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />

        {!selectedContract ? (
          <div className="kpi-card p-8 text-center">
            <p className="text-muted-foreground">Selecione um contrato para gerar a análise assistencial.</p>
          </div>
        ) : (
          <Tabs defaultValue="particularidades" className="space-y-4">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="particularidades">Particularidades</TabsTrigger>
              <TabsTrigger value="compilado">Compilado Unidade</TabsTrigger>
              <TabsTrigger value="cruzamento">Análise Cruzamento</TabsTrigger>
              <TabsTrigger value="relatorio">Relatório Final</TabsTrigger>
              <TabsTrigger value="personalizacao">Personalização</TabsTrigger>
              <TabsTrigger value="aprovacao">Aprovação</TabsTrigger>
            </TabsList>

            {/* TAB 1 — Particularidades do contrato */}
            <TabsContent value="particularidades" className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Valor global</p><p className="kpi-value">R$ {(selectedContract.value / 1e6).toFixed(1)}M</p></div>
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Parte variável</p><p className="kpi-value text-destructive">{(selectedContract.variable * 100).toFixed(0)}%</p></div>
                <div className="kpi-card"><p className="text-xs text-muted-foreground">R$ variável</p><p className="kpi-value text-destructive">R$ {((selectedContract.value * selectedContract.variable) / 1000).toFixed(0)}k</p></div>
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Período</p><p className="kpi-value text-sm">{selectedContract.period}</p></div>
              </div>

              {/* Rubricas */}
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold mb-3">Distribuição de Rubricas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    {(selectedContract.rubricas || []).map(r => (
                      <div key={r.id} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{r.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${r.percent}%` }} />
                          </div>
                          <span className="font-medium w-10 text-right">{r.percent}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={rubricaPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${value}%`}>
                          {rubricaPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Metas qualitativas */}
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold mb-3">Metas Qualitativas ({qualitativas.length})</h3>
                <div className="space-y-2">
                  {qualitativas.map((g, i) => {
                    const pct = g.target > 0 ? Math.round((g.achieved / g.target) * 100) : 0;
                    return (
                      <div key={i} className="flex justify-between items-center text-sm p-2 rounded bg-muted/30">
                        <span>{g.name}</span>
                        <div className="flex items-center gap-3">
                          <span className={`font-medium ${pct >= 100 ? "text-success" : "text-destructive"}`}>{pct >= 100 ? "Cumprida" : "Não cumprida"}</span>
                          <span className="text-xs text-muted-foreground">Peso: {g.weight}% | Penalidade: {g.penalty}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Metas quantitativas */}
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold mb-3">Metas Quantitativas ({quantitativas.length})</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={goalsBarData.filter(g => g.tipo === "QNT")} margin={{ left: 0, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="meta" fill="hsl(var(--primary))" name="Meta" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="realizado" fill="hsl(var(--accent))" name="Realizado" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Penalizações */}
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold mb-3">Penalizações e Glosas</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-center">
                    <p className="text-xs text-muted-foreground">Penalidade total</p>
                    <p className="text-lg font-bold text-destructive">{totalPenalty.toFixed(1)}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-center">
                    <p className="text-xs text-muted-foreground">Glosa estimada</p>
                    <p className="text-lg font-bold text-destructive">R$ {(totalGlosa / 1000).toFixed(0)}k</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
                    <p className="text-xs text-muted-foreground">Alcance ponderado</p>
                    <p className="text-lg font-bold text-primary">{goalAchievementPct}%</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {goals.filter(g => {
                    const pct = g.target > 0 ? (g.achieved / g.target) * 100 : 0;
                    return pct < 100;
                  }).map((g, i) => (
                    <div key={i} className="flex justify-between text-xs p-2 rounded bg-destructive/5">
                      <span className="text-foreground">{g.name}</span>
                      <span className="text-destructive font-medium">-{g.penalty}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2 — Compilado Unidade */}
            <TabsContent value="compilado" className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Unidade</p><p className="kpi-value text-sm">{unit}</p></div>
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Total metas</p><p className="kpi-value">{goals.length}</p></div>
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Alcance</p><p className="kpi-value text-primary">{goalAchievementPct}%</p></div>
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Estouradas</p><p className="kpi-value text-destructive">{estouradas.length}</p></div>
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Glosa</p><p className="kpi-value text-destructive">R$ {(totalGlosa / 1000).toFixed(0)}k</p></div>
              </div>

              {/* Radar */}
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold mb-3">Radar de Alcance por Meta</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                      <Radar name="Alcance %" dataKey="alcance" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                      <Radar name="Peso %" dataKey="peso" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.15} />
                      <Legend />
                      <Tooltip contentStyle={tooltipStyle} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly trend */}
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold mb-3">Evolução Mensal — Alocado vs Executado (R$ mil)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}k`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `R$ ${v}k`} />
                      <Legend />
                      <Line type="monotone" dataKey="alocado" stroke="hsl(var(--primary))" strokeWidth={2} name="Alocado" dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="executado" stroke="hsl(var(--destructive))" strokeWidth={2} name="Executado" dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Estouradas table */}
              {estouradas.length > 0 && (
                <div className="bg-card rounded-lg border border-border p-5">
                  <h3 className="text-sm font-semibold mb-3 text-destructive">Rubricas Estouradas</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="text-left py-2 pr-4">Rubrica</th>
                          <th className="text-right py-2 px-2">Alocado</th>
                          <th className="text-right py-2 px-2">Executado</th>
                          <th className="text-right py-2 px-2">Excedente</th>
                          <th className="text-right py-2 pl-2">% Exec</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estouradas.map((e, i) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            <td className="py-2 pr-4 font-medium">{e.rubrica}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">R$ {(e.allocated / 1000).toFixed(0)}k</td>
                            <td className="py-2 px-2 text-right">R$ {(e.executed / 1000).toFixed(0)}k</td>
                            <td className="py-2 px-2 text-right text-destructive font-medium">R$ {(e.excedente / 1000).toFixed(0)}k</td>
                            <td className="py-2 pl-2 text-right text-destructive font-medium">{e.pctExec}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 3 — Análise de Cruzamento */}
            <TabsContent value="cruzamento" className="space-y-6">
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold mb-3">Cruzamento: Metas × Penalizações × Glosas</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 pr-3">Meta</th>
                        <th className="py-2 px-2">Tipo</th>
                        <th className="text-right py-2 px-2">Meta</th>
                        <th className="text-right py-2 px-2">Realizado</th>
                        <th className="text-right py-2 px-2">%</th>
                        <th className="text-right py-2 px-2">Peso</th>
                        <th className="text-right py-2 px-2">Penalidade</th>
                        <th className="text-right py-2 px-2">Glosa (R$)</th>
                        <th className="py-2 pl-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crossAnalysisData.map((r, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="py-2 pr-3 font-medium">{r.meta}</td>
                          <td className="py-2 px-2 text-center"><span className={`text-xs px-1.5 py-0.5 rounded ${r.tipo === "QLT" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent-foreground"}`}>{r.tipo}</span></td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{r.target}</td>
                          <td className="py-2 px-2 text-right">{r.achieved}</td>
                          <td className="py-2 px-2 text-right font-medium">{r.pct}%</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{r.peso}%</td>
                          <td className={`py-2 px-2 text-right ${r.penalidade > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>{r.penalidade > 0 ? `-${r.penalidade}%` : "—"}</td>
                          <td className={`py-2 px-2 text-right ${r.glosa > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>{r.glosa > 0 ? `R$ ${(r.glosa / 1000).toFixed(1)}k` : "—"}</td>
                          <td className="py-2 pl-2">
                            <span className={`status-badge ${r.status === "Atingida" ? "status-success" : r.status === "Parcial" ? "status-warning" : "status-critical"}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Visual cross-analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card rounded-lg border border-border p-5">
                  <h3 className="text-sm font-semibold mb-3">Alcance vs Peso (todas as metas)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={crossAnalysisData} margin={{ left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="meta" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-30} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Bar dataKey="pct" fill="hsl(var(--primary))" name="Alcance %" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="peso" fill="hsl(var(--accent))" name="Peso %" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-card rounded-lg border border-border p-5">
                  <h3 className="text-sm font-semibold mb-3">Distribuição de Status</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Atingida", value: crossAnalysisData.filter(r => r.status === "Atingida").length },
                            { name: "Parcial", value: crossAnalysisData.filter(r => r.status === "Parcial").length },
                            { name: "Crítica", value: crossAnalysisData.filter(r => r.status === "Crítica").length },
                          ].filter(d => d.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          <Cell fill="#16a34a" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="hsl(var(--destructive))" />
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 4 — Relatório Final */}
            <TabsContent value="relatorio" className="space-y-6" ref={reportRef}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Relatório Final — {selectedContract.name}</h3>
                <Button onClick={handleExportPdf}>Exportar PDF</Button>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Alcance geral</p><p className={`kpi-value ${goalAchievementPct >= 80 ? "text-success" : "text-destructive"}`}>{goalAchievementPct}%</p></div>
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Glosa total</p><p className="kpi-value text-destructive">R$ {(totalGlosa / 1000).toFixed(0)}k</p></div>
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Metas atingidas</p><p className="kpi-value text-success">{crossAnalysisData.filter(r => r.status === "Atingida").length}/{goals.length}</p></div>
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Metas críticas</p><p className="kpi-value text-destructive">{crossAnalysisData.filter(r => r.status === "Crítica").length}</p></div>
              </div>

              {/* Timeline de Evidências, Ações e Justificativas */}
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold mb-1">Timeline de Evidências e Ações</h3>
                <p className="text-[11px] text-muted-foreground mb-4">Evidências, ações de promoção e justificativas vinculadas a esta unidade. O gestor pode aprovar, rejeitar e editar cada item.</p>

                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                  <div className="space-y-4">
                    {timelineItems
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((item) => {
                        const cat = categoryLabels[item.category] || { label: item.category, color: "bg-muted text-muted-foreground" };
                        const isEditing = editingItemId === item.id;
                        return (
                          <div key={item.id} className="relative pl-10">
                            {/* Dot */}
                            <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 border-background ${
                              item.status === "aprovado" ? "bg-emerald-500" : item.status === "rejeitado" ? "bg-destructive" : "bg-yellow-500"
                            }`} />

                            <div className={`rounded-lg border p-4 transition-colors ${
                              item.status === "rejeitado" ? "border-destructive/30 bg-destructive/5" : "border-border"
                            }`}>
                              {/* Header */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cat.color}`}>{cat.label}</span>
                                    <span className="text-[10px] text-muted-foreground">{new Date(item.date).toLocaleDateString("pt-BR")}</span>
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                      item.status === "aprovado" ? "bg-emerald-500/10 text-emerald-600" :
                                      item.status === "rejeitado" ? "bg-destructive/10 text-destructive" :
                                      "bg-yellow-500/10 text-yellow-600"
                                    }`}>
                                      {item.status === "aprovado" ? "✓ Aprovado" : item.status === "rejeitado" ? "✗ Rejeitado" : "⏳ Pendente"}
                                    </span>
                                  </div>
                                  <h4 className="text-sm font-medium mt-1">{item.title}</h4>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {!isEditing && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingItemId(item.id); setEditText(item.description); }}>
                                      Editar
                                    </Button>
                                  )}
                                  {isEditing && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={() => { setTimelineItems(prev => prev.map(ti => ti.id === item.id ? { ...ti, description: editText } : ti)); setEditingItemId(null); toast.success("Texto atualizado"); }}>
                                      Salvar
                                    </Button>
                                  )}
                                  {item.status === "pendente" && (
                                    <>
                                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={() => { setTimelineItems(prev => prev.map(ti => ti.id === item.id ? { ...ti, status: "aprovado" as const } : ti)); toast.success("Item aprovado"); }}>
                                        Aprovar
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => { setTimelineItems(prev => prev.map(ti => ti.id === item.id ? { ...ti, status: "rejeitado" as const } : ti)); toast.error("Item rejeitado"); }}>
                                        Rejeitar
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Body */}
                              {isEditing ? (
                                <Textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  rows={3}
                                  className="text-sm"
                                />
                              ) : (
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              )}

                              {/* File attachment */}
                              {item.fileName && (
                                <div className="mt-2 text-[11px] text-primary">
                                  📎 {item.fileName}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Editable notes */}
              <div className="bg-card rounded-lg border border-border p-5">
                <Label className="text-sm font-semibold">Observações do Analista (editável)</Label>
                <p className="text-[11px] text-muted-foreground mb-2">Adicione notas, justificativas ou recomendações que serão incluídas no PDF exportado</p>
                <Textarea
                  value={editableNotes}
                  onChange={(e) => setEditableNotes(e.target.value)}
                  placeholder="Insira suas observações, justificativas e recomendações aqui..."
                  rows={6}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleExportPdf} className="px-8">
                  Exportar Relatório PDF
                </Button>
              </div>
            </TabsContent>

            {/* TAB 5 — Personalização (edição completa do relatório) */}
            <TabsContent value="personalizacao" className="space-y-6">
              <div className="bg-card rounded-lg border border-border p-5">
                <h2 className="text-lg font-bold text-foreground mb-1">Personalização do Relatório</h2>
                <p className="text-sm text-muted-foreground mb-6">Visualize todas as páginas do relatório, edite textos e insira imagens em cada seção.</p>

                {(() => {
                  const contractKey = selectedContract.id;
                  if (persInitialized !== contractKey) {
                    const contratoText = `Contrato: ${selectedContract.name}\nUnidade: ${unit}\nValor global: R$ ${(selectedContract.value / 1e6).toFixed(1)}M\nParte variável: ${(selectedContract.variable * 100).toFixed(0)}%\nR$ variável: R$ ${((selectedContract.value * selectedContract.variable) / 1000).toFixed(0)}k\nPeríodo: ${selectedContract.period}\nAlcance ponderado: ${goalAchievementPct}%`;
                    const rubricasText = (selectedContract.rubricas || []).map(r => `${r.name}: ${r.percent}%`).join("\n") +
                      (estouradas.length > 0 ? "\n\n--- Rubricas estouradas ---\n" + estouradas.map(e => `${e.rubrica}: Alocado R$ ${(e.allocated / 1000).toFixed(0)}k | Executado R$ ${(e.executed / 1000).toFixed(0)}k | Excedente R$ ${(e.excedente / 1000).toFixed(0)}k (${e.pctExec}%)`).join("\n") : "");
                    const qualText = qualitativas.map(g => {
                      const pct = g.target > 0 ? Math.round((g.achieved / g.target) * 100) : 0;
                      return `${g.name} — ${pct >= 100 ? "Atingida" : "Não atingida"} | Peso: ${g.weight}% | Penalidade: ${g.penalty}%`;
                    }).join("\n");
                    const quantText = quantitativas.map(g => {
                      const pct = g.target > 0 ? Math.round((g.achieved / g.target) * 100) : 0;
                      return `${g.name} — Meta: ${g.target} | Realizado: ${g.achieved} | Alcance: ${pct}% | Peso: ${g.weight}% | Penalidade: ${g.penalty}%`;
                    }).join("\n");
                    const penText = `Penalidade total: ${totalPenalty.toFixed(1)}%\nGlosa estimada: R$ ${(totalGlosa / 1000).toFixed(0)}k\nMetas críticas: ${crossAnalysisData.filter(r => r.status === "Crítica").length}\n\n--- Detalhamento ---\n` +
                      crossAnalysisData.filter(r => r.penalidade > 0).map(r => `${r.meta}: -${r.penalidade}% (R$ ${(r.glosa / 1000).toFixed(0)}k)`).join("\n");
                    const evidText = timelineItems
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(item => {
                        const cat = categoryLabels[item.category];
                        return `[${cat?.label || item.category}] ${new Date(item.date).toLocaleDateString("pt-BR")} — ${item.title}\n${item.description}\nStatus: ${item.status}${item.fileName ? `\nArquivo: ${item.fileName}` : ""}`;
                      }).join("\n\n");
                    setTimeout(() => {
                      setPersContrato(contratoText);
                      setPersRubricas(rubricasText);
                      setPersQualitativas(qualText);
                      setPersQuantitativas(quantText);
                      setPersPenalidades(penText);
                      setPersEvidencias(evidText);
                      setPersInitialized(contractKey);
                    }, 0);
                  }
                  return null;
                })()}

                {(() => {
                  const handleImageUpload = (sectionKey: string) => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.multiple = true;
                    input.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (!files) return;
                      Array.from(files).forEach(file => {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const dataUrl = ev.target?.result as string;
                          setSectionImages(prev => ({
                            ...prev,
                            [sectionKey]: [...(prev[sectionKey] || []), dataUrl],
                          }));
                        };
                        reader.readAsDataURL(file);
                      });
                    };
                    input.click();
                  };

                  const removeImage = (sectionKey: string, idx: number) => {
                    setSectionImages(prev => ({
                      ...prev,
                      [sectionKey]: (prev[sectionKey] || []).filter((_, i) => i !== idx),
                    }));
                  };

                  const sections = [
                    { key: "contrato", label: "Página 1 — Dados do Contrato", value: persContrato, setter: setPersContrato, rows: 7 },
                    { key: "rubricas", label: "Página 2 — Distribuição de Rubricas", value: persRubricas, setter: setPersRubricas, rows: 8 },
                    { key: "qualitativas", label: "Página 3 — Metas Qualitativas", value: persQualitativas, setter: setPersQualitativas, rows: 6 },
                    { key: "quantitativas", label: "Página 4 — Metas Quantitativas", value: persQuantitativas, setter: setPersQuantitativas, rows: 6 },
                    { key: "penalidades", label: "Página 5 — Penalizações e Glosas", value: persPenalidades, setter: setPersPenalidades, rows: 8 },
                    { key: "evidencias", label: "Página 6 — Evidências e Ações", value: persEvidencias, setter: setPersEvidencias, rows: 10 },
                    { key: "observacoes", label: "Página 7 — Observações do Analista", value: editableNotes, setter: setEditableNotes, rows: 6 },
                  ];

                  return (
                    <div className="space-y-6">
                      {sections.map((section, idx) => (
                        <div key={section.key} className="border border-border rounded-lg overflow-hidden">
                          {/* Page header */}
                          <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">{section.label}</span>
                            <span className="text-[10px] text-muted-foreground">{idx + 1} / {sections.length}</span>
                          </div>

                          {/* Page body simulating A4 */}
                          <div className="p-5 bg-background space-y-3" style={{ minHeight: 200 }}>
                            <Textarea
                              value={section.value}
                              onChange={e => section.setter(e.target.value)}
                              rows={section.rows}
                              placeholder={`Conteúdo da ${section.label}...`}
                            />

                            {/* Inserted images */}
                            {(sectionImages[section.key] || []).length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                                {(sectionImages[section.key] || []).map((src, imgIdx) => (
                                  <div key={imgIdx} className="relative group rounded-lg overflow-hidden border border-border">
                                    <img src={src} alt={`Imagem ${imgIdx + 1}`} className="w-full h-32 object-cover" />
                                    <button
                                      onClick={() => removeImage(section.key, imgIdx)}
                                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[10px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleImageUpload(section.key)}
                            >
                              + Inserir imagem nesta seção
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => toast.success("Alterações salvas localmente")}>Salvar rascunho</Button>
                        <Button onClick={handleExportPdf} className="px-8">Exportar Relatório PDF</Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </TabsContent>

            {/* TAB 6 — Aprovação */}
            <TabsContent value="aprovacao" className="space-y-6">
              <div className="kpi-card p-6">
                <h2 className="text-lg font-bold text-foreground mb-4">Fluxo de Aprovação</h2>
                <p className="text-sm text-muted-foreground mb-4">Acompanhe o status de aprovação do relatório assistencial antes da publicação final.</p>
                <div className="space-y-3">
                  {[
                    { step: "Preenchimento de metas", status: "done" },
                    { step: "Inserção de evidências", status: "done" },
                    { step: "Revisão do gestor", status: "pending" },
                    { step: "Aprovação final", status: "waiting" },
                  ].map((item) => (
                    <div key={item.step} className={`flex items-center gap-3 p-3 rounded-lg border ${item.status === "done" ? "border-primary/20 bg-primary/5" : item.status === "pending" ? "border-accent bg-accent/5" : "border-border bg-muted/30"}`}>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${item.status === "done" ? "bg-primary/10 text-primary" : item.status === "pending" ? "bg-accent/20 text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                        {item.status === "done" ? "Concluído" : item.status === "pending" ? "Em andamento" : "Aguardando"}
                      </span>
                      <span className={`text-sm ${item.status === "done" ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>{item.step}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex gap-3">
                  <Button className="rounded-full">Aprovar Relatório</Button>
                  <Button variant="outline" className="rounded-full">Solicitar Revisão</Button>
                </div>
              </div>

              {/* Pontos de Melhoria */}
              <div className="kpi-card p-6">
                <h3 className="text-sm font-semibold text-foreground mb-2">Sinalizar Pontos de Melhoria</h3>
                <p className="text-xs text-muted-foreground mb-4">Registre observações e pontos que precisam de atenção antes da aprovação final.</p>
                <div className="flex gap-2 mb-4">
                  <Textarea
                    value={novoPonto}
                    onChange={(e) => setNovoPonto(e.target.value)}
                    placeholder="Descreva o ponto a melhorar..."
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    className="shrink-0 self-end"
                    onClick={() => {
                      if (novoPonto.trim()) {
                        setPontosMelhoria(prev => [...prev, novoPonto.trim()]);
                        setNovoPonto("");
                        toast.success("Ponto de melhoria registrado");
                      }
                    }}
                  >
                    Sinalizar
                  </Button>
                </div>
                {pontosMelhoria.length > 0 && (
                  <div className="space-y-2">
                    {pontosMelhoria.map((p, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 p-3 rounded-lg border border-border bg-muted/30 text-sm">
                        <span className="flex-1">{p}</span>
                        <Button variant="ghost" size="sm" className="text-xs text-destructive shrink-0 h-6" onClick={() => setPontosMelhoria(prev => prev.filter((_, idx) => idx !== i))}>
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default RelatorioAssistencialPage;
