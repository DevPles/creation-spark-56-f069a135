import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Pause, Play, ChevronRight, Download, FileText } from "lucide-react";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import GoalRow from "@/components/GoalRow";
import GoalModal from "@/components/GoalModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart,
} from "recharts";

const MOCK_GOALS = [
  { id: "1", name: "Taxa de ocupação de leitos", target: 85, current: 78, unit: "%", type: "QNT" as const, risk: 12400, trend: "down" as const },
  { id: "2", name: "Tempo médio de espera (emergência)", target: 30, current: 42, unit: "min", type: "QNT" as const, risk: 8200, trend: "up" as const },
  { id: "3", name: "Satisfação do paciente (NPS)", target: 75, current: 71, unit: "pts", type: "QNT" as const, risk: 5600, trend: "stable" as const },
  { id: "4", name: "Protocolo de higienização", target: 100, current: 92, unit: "%", type: "QLT" as const, risk: 3100, trend: "up" as const },
  { id: "5", name: "Relatório quadrimestral (RDQA)", target: 1, current: 0, unit: "doc", type: "DOC" as const, risk: 15000, trend: "down" as const },
  { id: "6", name: "Taxa de infecção hospitalar", target: 5, current: 6.2, unit: "%", type: "QNT" as const, risk: 9800, trend: "down" as const },
  { id: "7", name: "Cirurgias eletivas realizadas", target: 120, current: 98, unit: "un", type: "QNT" as const, risk: 7300, trend: "up" as const },
  { id: "8", name: "Comissão de óbitos ativa", target: 1, current: 1, unit: "doc", type: "QLT" as const, risk: 0, trend: "stable" as const },
];

const PERFORMANCE_DATA = [
  { month: "Jan", atingidas: 65, parciais: 20, naoAtingidas: 15 },
  { month: "Fev", atingidas: 70, parciais: 18, naoAtingidas: 12 },
  { month: "Mar", atingidas: 68, parciais: 22, naoAtingidas: 10 },
  { month: "Abr", atingidas: 75, parciais: 15, naoAtingidas: 10 },
];

const RISK_TREND = [
  { month: "Jan", risco: 85000, glosa: 12000 },
  { month: "Fev", risco: 72000, glosa: 9500 },
  { month: "Mar", risco: 61800, glosa: 8200 },
  { month: "Abr", risco: 54400, glosa: 7100 },
];

const TYPE_DIST = [
  { name: "Quantitativas", value: 5, color: "hsl(var(--primary))" },
  { name: "Qualitativas", value: 2, color: "hsl(var(--accent))" },
  { name: "Documentais", value: 1, color: "hsl(var(--muted-foreground))" },
];

const UNIT_COMPARISON = [
  { unit: "Hospital Geral", atingimento: 78, risco: 32000 },
  { unit: "UPA Norte", atingimento: 85, risco: 14000 },
  { unit: "UBS Centro", atingimento: 62, risco: 8400 },
];

const REPORT_TYPES = [
  { id: "consolidado", label: "Consolidado geral", description: "Resumo de todas as metas, atingimento e risco financeiro" },
  { id: "rdqa", label: "RDQA — Relatório Detalhado", description: "Exigido pela LC 141/2012, art. 36" },
  { id: "contrato", label: "Relatório por contrato", description: "Detalhamento financeiro e glosas por contrato" },
  { id: "metas", label: "Relatório de metas", description: "Evolução e projeções por indicador" },
  { id: "risco", label: "Análise de risco", description: "Cenários e priorização de recuperação" },
  { id: "evidencias", label: "Status de evidências", description: "Listagem de documentos enviados e pendentes" },
];

const GENERATED_REPORTS = [
  { id: "1", name: "Consolidado Q1 2024 — Hospital Geral", date: "15/04/2024", type: "consolidado", size: "1.2 MB" },
  { id: "2", name: "RDQA 1º Quadrimestre 2024", date: "30/04/2024", type: "rdqa", size: "3.4 MB" },
  { id: "3", name: "Risco financeiro — Mar 2024", date: "01/04/2024", type: "risco", size: "0.8 MB" },
];

const totalRisk = MOCK_GOALS.reduce((s, g) => s + g.risk, 0);
const atingidas = MOCK_GOALS.filter(g => (g.current / g.target) * 100 >= 90).length;
const parciais = MOCK_GOALS.filter(g => { const p = (g.current / g.target) * 100; return p >= 60 && p < 90; }).length;
const criticas = MOCK_GOALS.filter(g => (g.current / g.target) * 100 < 60).length;

const formatCurrency = (v: number) => `R$ ${(v / 1000).toFixed(0)}k`;

/* ── Carousel slides ── */
const INSIGHT_SLIDES = [
  {
    id: "kpis",
    title: "Visão Geral",
    content: (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card"><p className="text-xs text-muted-foreground">Risco financeiro total</p><p className="text-2xl font-bold text-destructive">R$ {(totalRisk / 1000).toFixed(1)}k</p></div>
        <div className="kpi-card"><p className="text-xs text-muted-foreground">Metas atingidas</p><p className="text-2xl font-bold" style={{ color: "hsl(142 71% 45%)" }}>{atingidas}/{MOCK_GOALS.length}</p></div>
        <div className="kpi-card"><p className="text-xs text-muted-foreground">Parcialmente atingidas</p><p className="text-2xl font-bold" style={{ color: "hsl(38 92% 50%)" }}>{parciais}</p></div>
        <div className="kpi-card"><p className="text-xs text-muted-foreground">Críticas</p><p className="text-2xl font-bold text-destructive">{criticas}</p></div>
      </div>
    ),
  },
  {
    id: "performance",
    title: "Evolução de Desempenho",
    content: (
      <div className="bg-card rounded-lg border border-border p-5">
        <p className="text-xs text-muted-foreground mb-4">% de metas por status ao longo do quadrimestre</p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={PERFORMANCE_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="atingidas" stackId="1" stroke="hsl(142 71% 45%)" fill="hsl(142 71% 45% / 0.3)" name="Atingidas %" />
            <Area type="monotone" dataKey="parciais" stackId="1" stroke="hsl(38 92% 50%)" fill="hsl(38 92% 50% / 0.3)" name="Parciais %" />
            <Area type="monotone" dataKey="naoAtingidas" stackId="1" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.3)" name="Não atingidas %" />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    ),
  },
  {
    id: "risk",
    title: "Risco Financeiro & Glosas",
    content: (
      <div className="bg-card rounded-lg border border-border p-5">
        <p className="text-xs text-muted-foreground mb-4">Evolução mensal em R$</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={RISK_TREND}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="risco" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} name="Risco" />
            <Line type="monotone" dataKey="glosa" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={{ r: 4 }} name="Glosa" />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    ),
  },
  {
    id: "distribution",
    title: "Distribuição & Comparativo",
    content: (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-lg border border-border p-5">
          <p className="text-xs text-muted-foreground mb-4">Por tipo de meta</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={TYPE_DIST} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4}>
                {TYPE_DIST.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-5">
          <p className="text-xs text-muted-foreground mb-4">Comparativo por unidade</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={UNIT_COMPARISON} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="unit" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="atingimento" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Atingimento %" />
              <Bar yAxisId="right" dataKey="risco" fill="hsl(var(--destructive) / 0.6)" radius={[6, 6, 0, 0]} name="Risco R$" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    ),
  },
];

/* ── PDF generation helper ── */
function generatePdfBlob(type: string, includeCharts: boolean, includeDetails: boolean) {
  const reportLabel = REPORT_TYPES.find(t => t.id === type)?.label || type;
  const now = new Date().toLocaleDateString("pt-BR");

  let content = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n`;
  
  const lines: string[] = [];
  lines.push(`SisLu - Sistema de Acompanhamento`);
  lines.push(`Relatorio: ${reportLabel}`);
  lines.push(`Data: ${now}`);
  lines.push(``);
  lines.push(`RESUMO EXECUTIVO`);
  lines.push(`Total de metas: ${MOCK_GOALS.length}`);
  lines.push(`Atingidas: ${atingidas} | Parciais: ${parciais} | Criticas: ${criticas}`);
  lines.push(`Risco financeiro total: R$ ${totalRisk.toLocaleString("pt-BR")}`);
  lines.push(``);

  if (includeDetails) {
    lines.push(`DETALHAMENTO POR META`);
    MOCK_GOALS.forEach(g => {
      const pct = ((g.current / g.target) * 100).toFixed(1);
      lines.push(`- ${g.name}: ${pct}% (Meta: ${g.target}${g.unit} | Real: ${g.current}${g.unit} | Risco: R$ ${g.risk.toLocaleString("pt-BR")})`);
    });
    lines.push(``);
  }

  if (includeCharts) {
    lines.push(`EVOLUCAO MENSAL`);
    PERFORMANCE_DATA.forEach(d => lines.push(`  ${d.month}: Atingidas ${d.atingidas}% | Parciais ${d.parciais}% | Nao atingidas ${d.naoAtingidas}%`));
    lines.push(``);
    lines.push(`RISCO FINANCEIRO MENSAL`);
    RISK_TREND.forEach(d => lines.push(`  ${d.month}: Risco R$ ${d.risco.toLocaleString("pt-BR")} | Glosa R$ ${d.glosa.toLocaleString("pt-BR")}`));
  }

  const textBlock = lines.join("\n");

  const streamContent = `BT /F1 14 Tf 50 780 Td (${lines[0]}) Tj ET\n` +
    lines.slice(1).map((line, i) => `BT /F1 10 Tf 50 ${760 - i * 16} Td (${line.replace(/[()\\]/g, "")}) Tj ET`).join("\n");

  content += `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n`;
  content += `4 0 obj<</Length ${streamContent.length}>>stream\n${streamContent}\nendstream\nendobj\n`;
  content += `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n`;
  
  const xrefOffset = content.length;
  content += `xref\n0 6\n0000000000 65535 f \n`;
  let offset = 0;
  for (let i = 1; i <= 5; i++) {
    const idx = content.indexOf(`${i} 0 obj`);
    content += `${String(idx).padStart(10, "0")} 00000 n \n`;
  }
  content += `trailer<</Size 6/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([textBlock], { type: "application/pdf" });
}

const RelatoriosPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("4M");
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [selectedType, setSelectedType] = useState("consolidado");
  const [metaFilter, setMetaFilter] = useState("todas");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [reports, setReports] = useState(GENERATED_REPORTS);

  const [selectedGoal, setSelectedGoal] = useState<typeof MOCK_GOALS[0] | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  /* Carousel state */
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentSlide(prev => (prev + 1) % INSIGHT_SLIDES.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide(prev => (prev - 1 + INSIGHT_SLIDES.length) % INSIGHT_SLIDES.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(nextSlide, 8000);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  const handleGenerate = () => {
    const blob = generatePdfBlob(selectedType, includeCharts, includeDetails);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const reportLabel = REPORT_TYPES.find(t => t.id === selectedType)?.label || selectedType;
    const fileName = `SisLu_${reportLabel.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const newReport = {
      id: crypto.randomUUID(),
      name: `${reportLabel} — ${new Date().toLocaleDateString("pt-BR")}`,
      date: new Date().toLocaleDateString("pt-BR"),
      type: selectedType,
      size: `${(blob.size / 1024).toFixed(0)} KB`,
    };
    setReports(prev => [newReport, ...prev]);
    toast.success("PDF gerado e baixado!", { description: fileName });
  };

  const handleDownloadReport = (report: typeof GENERATED_REPORTS[0]) => {
    const blob = generatePdfBlob(report.type, true, true);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SisLu_${report.name.replace(/\s/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Download iniciado");
  };

  const handleGoalClick = (goal: typeof MOCK_GOALS[0]) => {
    setSelectedGoal(goal);
    setGoalModalOpen(true);
  };

  const filteredGoals = MOCK_GOALS.filter(g => {
    if (metaFilter === "todas") return true;
    if (metaFilter === "atingidas") return (g.current / g.target) * 100 >= 90;
    if (metaFilter === "parciais") { const p = (g.current / g.target) * 100; return p >= 60 && p < 90; }
    if (metaFilter === "criticas") return (g.current / g.target) * 100 < 60;
    if (metaFilter === "QNT" || metaFilter === "QLT" || metaFilter === "DOC") return g.type === metaFilter;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" /> Voltar ao painel
        </button>

        <PageHeader
          title="Relatórios & Dashboard"
          subtitle="Acompanhamento em tempo real de metas, riscos e desempenho"
          period={period} onPeriodChange={setPeriod}
          selectedUnit={selectedUnit} onUnitChange={setSelectedUnit}
        />

        {/* ─── CAROUSEL ─── */}
        <div className="relative mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {INSIGHT_SLIDES.map((slide, i) => (
                <button
                  key={slide.id}
                  onClick={() => setCurrentSlide(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === currentSlide ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsPaused(!isPaused)}>
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevSlide}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextSlide}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35 }}
            >
              <h3 className="font-display font-semibold text-lg text-foreground mb-3">
                {INSIGHT_SLIDES[currentSlide].title}
              </h3>
              {INSIGHT_SLIDES[currentSlide].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ─── METAS TABLE ─── */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-display font-semibold text-lg text-foreground">Metas do período</h3>
            <Select value={metaFilter} onValueChange={setMetaFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar metas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as metas</SelectItem>
                <SelectItem value="atingidas">Atingidas (≥90%)</SelectItem>
                <SelectItem value="parciais">Parciais (60-89%)</SelectItem>
                <SelectItem value="criticas">Críticas (&lt;60%)</SelectItem>
                <SelectItem value="QNT">Quantitativas</SelectItem>
                <SelectItem value="QLT">Qualitativas</SelectItem>
                <SelectItem value="DOC">Documentais</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card rounded-lg border border-border">
            <div className="divide-y divide-border">
              {filteredGoals.map((goal, i) => (
                <GoalRow key={goal.id} goal={goal} index={i} onClick={() => handleGoalClick(goal)} />
              ))}
              {filteredGoals.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma meta encontrada com este filtro.</p>
              )}
            </div>
          </div>
        </div>

        {/* ─── GERAR RELATÓRIO ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="kpi-card space-y-4">
              <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5" /> Gerar relatório
              </h2>
              <div className="space-y-2">
                <Label>Tipo de relatório</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">{REPORT_TYPES.find(t => t.id === selectedType)?.description}</p>
              </div>
              <div className="space-y-3">
                <Label>Opções</Label>
                <div className="flex items-center gap-2">
                  <Checkbox id="charts" checked={includeCharts} onCheckedChange={(c) => setIncludeCharts(!!c)} />
                  <label htmlFor="charts" className="text-sm text-foreground cursor-pointer">Incluir gráficos</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="details" checked={includeDetails} onCheckedChange={(c) => setIncludeDetails(!!c)} />
                  <label htmlFor="details" className="text-sm text-foreground cursor-pointer">Detalhamento por meta</label>
                </div>
              </div>
              <Button className="w-full" onClick={handleGenerate}>
                <Download className="w-4 h-4 mr-2" /> Gerar e baixar PDF
              </Button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h2 className="font-display font-semibold text-foreground mb-3">Relatórios gerados</h2>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border grid grid-cols-12 text-xs font-medium text-muted-foreground">
                <span className="col-span-5">Nome</span><span className="col-span-2">Data</span><span className="col-span-2">Tipo</span><span className="col-span-1">Tam.</span><span className="col-span-2 text-right">Ação</span>
              </div>
              {reports.map((report, i) => (
                <motion.div key={report.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="px-5 py-3 grid grid-cols-12 items-center text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <span className="col-span-5 font-medium text-foreground truncate">{report.name}</span>
                  <span className="col-span-2 text-muted-foreground">{report.date}</span>
                  <span className="col-span-2"><span className="status-badge bg-accent text-accent-foreground">{report.type}</span></span>
                  <span className="col-span-1 text-muted-foreground">{report.size}</span>
                  <span className="col-span-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => handleDownloadReport(report)}>
                      <Download className="w-3 h-3 mr-1" /> PDF
                    </Button>
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <GoalModal goal={selectedGoal} open={goalModalOpen} onOpenChange={setGoalModalOpen} />
    </div>
  );
};

export default RelatoriosPage;
