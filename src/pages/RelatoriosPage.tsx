import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
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
  { id: "rdqa", label: "RDQA — Relatório Detalhado do Quadrimestre", description: "Exigido pela LC 141/2012, art. 36" },
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

const RelatoriosPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("4M");
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [selectedType, setSelectedType] = useState("consolidado");
  const [metaFilter, setMetaFilter] = useState("todas");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [reports] = useState(GENERATED_REPORTS);

  const [selectedGoal, setSelectedGoal] = useState<typeof MOCK_GOALS[0] | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  const handleGenerate = () => {
    toast.success("Relatório sendo gerado...", { description: "O PDF será disponibilizado em instantes." });
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
          subtitle="Acompanhamento completo de metas, riscos e desempenho"
          period={period} onPeriodChange={setPeriod}
          selectedUnit={selectedUnit} onUnitChange={setSelectedUnit}
        />

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="metas">Metas</TabsTrigger>
            <TabsTrigger value="gerar">Gerar Relatório</TabsTrigger>
          </TabsList>

          {/* ─── DASHBOARD TAB ─── */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
                <p className="text-xs text-muted-foreground">Risco financeiro total</p>
                <p className="text-2xl font-bold text-destructive">R$ {(totalRisk / 1000).toFixed(1)}k</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="kpi-card">
                <p className="text-xs text-muted-foreground">Metas atingidas</p>
                <p className="text-2xl font-bold text-emerald-600">{atingidas}/{MOCK_GOALS.length}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="kpi-card">
                <p className="text-xs text-muted-foreground">Parcialmente atingidas</p>
                <p className="text-2xl font-bold text-amber-500">{parciais}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="kpi-card">
                <p className="text-xs text-muted-foreground">Críticas</p>
                <p className="text-2xl font-bold text-destructive">{criticas}</p>
              </motion.div>
            </div>

            {/* Charts row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-card rounded-lg border border-border p-5">
                <h3 className="font-display font-semibold text-foreground mb-1">Evolução de desempenho</h3>
                <p className="text-xs text-muted-foreground mb-4">% de metas por status ao longo do quadrimestre</p>
                <ResponsiveContainer width="100%" height={260}>
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
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-card rounded-lg border border-border p-5">
                <h3 className="font-display font-semibold text-foreground mb-1">Risco financeiro & Glosas</h3>
                <p className="text-xs text-muted-foreground mb-4">Evolução mensal em R$</p>
                <ResponsiveContainer width="100%" height={260}>
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
              </motion.div>
            </div>

            {/* Charts row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-card rounded-lg border border-border p-5">
                <h3 className="font-display font-semibold text-foreground mb-1">Distribuição por tipo</h3>
                <p className="text-xs text-muted-foreground mb-4">Quantitativa / Qualitativa / Documental</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={TYPE_DIST} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4}>
                      {TYPE_DIST.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="lg:col-span-2 bg-card rounded-lg border border-border p-5">
                <h3 className="font-display font-semibold text-foreground mb-1">Comparativo por unidade</h3>
                <p className="text-xs text-muted-foreground mb-4">Atingimento (%) e risco financeiro (R$)</p>
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
              </motion.div>
            </div>
          </TabsContent>

          {/* ─── METAS TAB ─── */}
          <TabsContent value="metas" className="space-y-4">
            {/* Smart filters */}
            <div className="flex flex-wrap items-center gap-3">
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
              <span className="text-xs text-muted-foreground">
                {filteredGoals.length} meta{filteredGoals.length !== 1 ? "s" : ""} encontrada{filteredGoals.length !== 1 ? "s" : ""}
              </span>
            </div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg border border-border">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-display font-semibold text-foreground">Metas do período</h2>
                <p className="text-sm text-muted-foreground">{selectedUnit}</p>
              </div>
              <div className="divide-y divide-border">
                {filteredGoals.map((goal, i) => (
                  <GoalRow key={goal.id} goal={goal} index={i} onClick={() => handleGoalClick(goal)} />
                ))}
                {filteredGoals.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma meta encontrada com este filtro.</p>
                )}
              </div>
            </motion.div>
          </TabsContent>

          {/* ─── GERAR RELATÓRIO TAB ─── */}
          <TabsContent value="gerar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="kpi-card space-y-4">
                  <h2 className="font-display font-semibold text-foreground">Gerar novo relatório</h2>
                  <div className="space-y-2">
                    <Label>Tipo de relatório</Label>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REPORT_TYPES.map((t) => (<SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">{REPORT_TYPES.find((t) => t.id === selectedType)?.description}</p>
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
                  <Button className="w-full" onClick={handleGenerate}>Gerar PDF</Button>
                </motion.div>
              </div>

              <div className="lg:col-span-2">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <h2 className="font-display font-semibold text-foreground mb-3">Relatórios gerados</h2>
                  <div className="bg-card rounded-lg border border-border overflow-hidden">
                    <div className="px-5 py-3 border-b border-border grid grid-cols-12 text-xs font-medium text-muted-foreground">
                      <span className="col-span-5">Nome</span><span className="col-span-2">Data</span><span className="col-span-2">Tipo</span><span className="col-span-1">Tamanho</span><span className="col-span-2 text-right">Ação</span>
                    </div>
                    {reports.map((report, i) => (
                      <motion.div key={report.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="px-5 py-3 grid grid-cols-12 items-center text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <span className="col-span-5 font-medium text-foreground">{report.name}</span>
                        <span className="col-span-2 text-muted-foreground">{report.date}</span>
                        <span className="col-span-2"><span className="status-badge bg-accent text-accent-foreground">{report.type}</span></span>
                        <span className="col-span-1 text-muted-foreground">{report.size}</span>
                        <span className="col-span-2 text-right"><Button variant="outline" size="sm">Baixar PDF</Button></span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <GoalModal goal={selectedGoal} open={goalModalOpen} onOpenChange={setGoalModalOpen} />
    </div>
  );
};

export default RelatoriosPage;
