import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

/* ══════════════════════════════════════════════
   MOCK DATA — Contratos de gestão
   ══════════════════════════════════════════════ */

interface ContractData {
  id: string;
  name: string;
  unit: string;
  valorGlobal: number;
  rubricas: { name: string; pct: number; valor: number }[];
  goals: GoalItem[];
  performance: { month: string; atingidas: number; parciais: number; naoAtingidas: number }[];
  riskTrend: { month: string; risco: number; glosa: number }[];
}

interface GoalItem {
  id: string; name: string; target: number; current: number; unit: string;
  type: "QNT" | "QLT" | "DOC"; risk: number; trend: "up" | "down" | "stable";
  rubrica: string; pesoFinanceiro: number;
}

const CONTRACTS: ContractData[] = [
  {
    id: "c1", name: "Contrato 001/2024 — Hospital Geral", unit: "Hospital Geral", valorGlobal: 2800000,
    rubricas: [
      { name: "RH", pct: 55, valor: 1540000 },
      { name: "Insumos", pct: 20, valor: 560000 },
      { name: "Equipamentos", pct: 10, valor: 280000 },
      { name: "Metas Quantitativas", pct: 10, valor: 280000 },
      { name: "Metas Qualitativas", pct: 5, valor: 140000 },
    ],
    goals: [
      { id: "g1", name: "Taxa de ocupação de leitos", target: 85, current: 78, unit: "%", type: "QNT", risk: 12400, trend: "down", rubrica: "Metas Quantitativas", pesoFinanceiro: 4.4 },
      { id: "g2", name: "Tempo médio de espera (emergência)", target: 30, current: 42, unit: "min", type: "QNT", risk: 8200, trend: "up", rubrica: "Metas Quantitativas", pesoFinanceiro: 2.9 },
      { id: "g3", name: "Satisfação do paciente (NPS)", target: 75, current: 71, unit: "pts", type: "QNT", risk: 5600, trend: "stable", rubrica: "Metas Quantitativas", pesoFinanceiro: 2.0 },
      { id: "g4", name: "Protocolo de higienização", target: 100, current: 92, unit: "%", type: "QLT", risk: 3100, trend: "up", rubrica: "Metas Qualitativas", pesoFinanceiro: 2.2 },
      { id: "g5", name: "Relatório quadrimestral (RDQA)", target: 1, current: 0, unit: "doc", type: "DOC", risk: 15000, trend: "down", rubrica: "Metas Qualitativas", pesoFinanceiro: 5.4 },
      { id: "g6", name: "Taxa de infecção hospitalar", target: 5, current: 6.2, unit: "%", type: "QNT", risk: 9800, trend: "down", rubrica: "Metas Quantitativas", pesoFinanceiro: 3.5 },
      { id: "g7", name: "Cirurgias eletivas realizadas", target: 120, current: 98, unit: "un", type: "QNT", risk: 7300, trend: "up", rubrica: "Metas Quantitativas", pesoFinanceiro: 2.6 },
      { id: "g8", name: "Comissão de óbitos ativa", target: 1, current: 1, unit: "doc", type: "QLT", risk: 0, trend: "stable", rubrica: "Metas Qualitativas", pesoFinanceiro: 0 },
    ],
    performance: [
      { month: "Jan", atingidas: 65, parciais: 20, naoAtingidas: 15 },
      { month: "Fev", atingidas: 70, parciais: 18, naoAtingidas: 12 },
      { month: "Mar", atingidas: 68, parciais: 22, naoAtingidas: 10 },
      { month: "Abr", atingidas: 75, parciais: 15, naoAtingidas: 10 },
    ],
    riskTrend: [
      { month: "Jan", risco: 85000, glosa: 12000 },
      { month: "Fev", risco: 72000, glosa: 9500 },
      { month: "Mar", risco: 61800, glosa: 8200 },
      { month: "Abr", risco: 54400, glosa: 7100 },
    ],
  },
  {
    id: "c2", name: "Contrato 002/2024 — UPA Norte", unit: "UPA Norte", valorGlobal: 1200000,
    rubricas: [
      { name: "RH", pct: 60, valor: 720000 },
      { name: "Insumos", pct: 18, valor: 216000 },
      { name: "Equipamentos", pct: 7, valor: 84000 },
      { name: "Metas Quantitativas", pct: 10, valor: 120000 },
      { name: "Metas Qualitativas", pct: 5, valor: 60000 },
    ],
    goals: [
      { id: "g9", name: "Tempo porta-médico", target: 15, current: 12, unit: "min", type: "QNT", risk: 0, trend: "up", rubrica: "Metas Quantitativas", pesoFinanceiro: 0 },
      { id: "g10", name: "Atendimentos/dia", target: 200, current: 185, unit: "un", type: "QNT", risk: 3200, trend: "stable", rubrica: "Metas Quantitativas", pesoFinanceiro: 2.7 },
      { id: "g11", name: "Classificação de risco (Manchester)", target: 100, current: 97, unit: "%", type: "QLT", risk: 0, trend: "up", rubrica: "Metas Qualitativas", pesoFinanceiro: 0 },
      { id: "g12", name: "Taxa de retorno em 24h", target: 5, current: 7.8, unit: "%", type: "QNT", risk: 4100, trend: "down", rubrica: "Metas Quantitativas", pesoFinanceiro: 3.4 },
      { id: "g13", name: "Protocolo sepse ativo", target: 1, current: 1, unit: "doc", type: "QLT", risk: 0, trend: "stable", rubrica: "Metas Qualitativas", pesoFinanceiro: 0 },
      { id: "g14", name: "Notificações epidemiológicas", target: 100, current: 88, unit: "%", type: "QNT", risk: 2800, trend: "up", rubrica: "Metas Quantitativas", pesoFinanceiro: 2.3 },
    ],
    performance: [
      { month: "Jan", atingidas: 72, parciais: 18, naoAtingidas: 10 },
      { month: "Fev", atingidas: 78, parciais: 14, naoAtingidas: 8 },
      { month: "Mar", atingidas: 80, parciais: 12, naoAtingidas: 8 },
      { month: "Abr", atingidas: 85, parciais: 10, naoAtingidas: 5 },
    ],
    riskTrend: [
      { month: "Jan", risco: 28000, glosa: 4200 },
      { month: "Fev", risco: 22000, glosa: 3100 },
      { month: "Mar", risco: 18000, glosa: 2600 },
      { month: "Abr", risco: 10100, glosa: 1800 },
    ],
  },
  {
    id: "c3", name: "Contrato 003/2024 — UBS Centro", unit: "UBS Centro", valorGlobal: 680000,
    rubricas: [
      { name: "RH", pct: 65, valor: 442000 },
      { name: "Insumos", pct: 15, valor: 102000 },
      { name: "Equipamentos", pct: 5, valor: 34000 },
      { name: "Metas Quantitativas", pct: 10, valor: 68000 },
      { name: "Metas Qualitativas", pct: 5, valor: 34000 },
    ],
    goals: [
      { id: "g15", name: "Consultas agendadas realizadas", target: 90, current: 72, unit: "%", type: "QNT", risk: 5400, trend: "down", rubrica: "Metas Quantitativas", pesoFinanceiro: 7.9 },
      { id: "g16", name: "Cobertura vacinal", target: 95, current: 88, unit: "%", type: "QNT", risk: 3200, trend: "up", rubrica: "Metas Quantitativas", pesoFinanceiro: 4.7 },
      { id: "g17", name: "Visitas domiciliares ACS", target: 80, current: 65, unit: "%", type: "QNT", risk: 4600, trend: "down", rubrica: "Metas Quantitativas", pesoFinanceiro: 6.8 },
      { id: "g18", name: "Programa hiperdia atualizado", target: 1, current: 0, unit: "doc", type: "DOC", risk: 6200, trend: "down", rubrica: "Metas Qualitativas", pesoFinanceiro: 9.1 },
      { id: "g19", name: "Pré-natal (6+ consultas)", target: 85, current: 79, unit: "%", type: "QNT", risk: 2100, trend: "stable", rubrica: "Metas Quantitativas", pesoFinanceiro: 3.1 },
    ],
    performance: [
      { month: "Jan", atingidas: 50, parciais: 30, naoAtingidas: 20 },
      { month: "Fev", atingidas: 55, parciais: 25, naoAtingidas: 20 },
      { month: "Mar", atingidas: 58, parciais: 27, naoAtingidas: 15 },
      { month: "Abr", atingidas: 62, parciais: 23, naoAtingidas: 15 },
    ],
    riskTrend: [
      { month: "Jan", risco: 32000, glosa: 5800 },
      { month: "Fev", risco: 28000, glosa: 4900 },
      { month: "Mar", risco: 24000, glosa: 4200 },
      { month: "Abr", risco: 21500, glosa: 3600 },
    ],
  },
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

const formatCurrency = (v: number) => `R$ ${(v / 1000).toFixed(0)}k`;
const formatFullCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;
const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

/* ── Helpers ── */
function getGoalPct(g: GoalItem) {
  if (g.type === "DOC") return g.current >= g.target ? 100 : 0;
  return Math.min(100, (g.current / g.target) * 100);
}

function filterGoals(goals: GoalItem[], typeFilter: string, statusFilter: string) {
  return goals.filter(g => {
    const pct = getGoalPct(g);
    if (typeFilter === "QNT" && g.type !== "QNT") return false;
    if (typeFilter === "QLT" && g.type !== "QLT") return false;
    if (typeFilter === "DOC" && g.type !== "DOC") return false;
    if (statusFilter === "atingidas" && pct < 90) return false;
    if (statusFilter === "parciais" && (pct < 60 || pct >= 90)) return false;
    if (statusFilter === "criticas" && pct >= 60) return false;
    if (statusFilter === "em_risco" && g.risk <= 0) return false;
    return true;
  });
}

function computeStats(goals: GoalItem[]) {
  const totalRisk = goals.reduce((s, g) => s + g.risk, 0);
  const atingidas = goals.filter(g => getGoalPct(g) >= 90).length;
  const parciais = goals.filter(g => { const p = getGoalPct(g); return p >= 60 && p < 90; }).length;
  const criticas = goals.filter(g => getGoalPct(g) < 60).length;
  const avg = goals.length ? Math.round(goals.reduce((s, g) => s + getGoalPct(g), 0) / goals.length) : 0;
  return { totalRisk, atingidas, parciais, criticas, avg, total: goals.length };
}

/* ── PDF generation ── */
function generatePdfBlob(goals: GoalItem[], contractName: string, type: string, includeCharts: boolean, includeDetails: boolean) {
  const reportLabel = REPORT_TYPES.find(t => t.id === type)?.label || type;
  const now = new Date().toLocaleDateString("pt-BR");
  const stats = computeStats(goals);

  const lines: string[] = [];
  lines.push(`════════════════════════════════════════════════════`);
  lines.push(`  SisLu — Sistema de Acompanhamento de Metas`);
  lines.push(`════════════════════════════════════════════════════`);
  lines.push(``);
  lines.push(`  Relatório: ${reportLabel}`);
  lines.push(`  Contrato: ${contractName}`);
  lines.push(`  Data de geração: ${now}`);
  lines.push(``);
  lines.push(`────────────────────────────────────────────────────`);
  lines.push(`  RESUMO EXECUTIVO`);
  lines.push(`────────────────────────────────────────────────────`);
  lines.push(``);
  lines.push(`  Total de metas avaliadas: ${stats.total}`);
  lines.push(`  Atingidas (≥90%):        ${stats.atingidas}`);
  lines.push(`  Parciais (60-89%):       ${stats.parciais}`);
  lines.push(`  Críticas (<60%):         ${stats.criticas}`);
  lines.push(`  Atingimento médio:       ${stats.avg}%`);
  lines.push(`  Risco financeiro total:  ${formatFullCurrency(stats.totalRisk)}`);
  lines.push(``);

  if (includeDetails) {
    lines.push(`────────────────────────────────────────────────────`);
    lines.push(`  DETALHAMENTO POR META`);
    lines.push(`────────────────────────────────────────────────────`);
    lines.push(``);
    goals.forEach((g, i) => {
      const pct = getGoalPct(g).toFixed(1);
      lines.push(`  ${i + 1}. ${g.name}`);
      lines.push(`     Tipo: ${g.type} | Rubrica: ${g.rubrica}`);
      lines.push(`     Meta: ${g.target}${g.unit} | Realizado: ${g.current}${g.unit} | Atingimento: ${pct}%`);
      lines.push(`     Risco: ${formatFullCurrency(g.risk)} | Peso financeiro: ${g.pesoFinanceiro}%`);
      lines.push(``);
    });
  }

  if (includeCharts) {
    lines.push(`────────────────────────────────────────────────────`);
    lines.push(`  DISTRIBUIÇÃO POR TIPO`);
    lines.push(`────────────────────────────────────────────────────`);
    lines.push(``);
    lines.push(`  Quantitativas: ${goals.filter(g => g.type === "QNT").length} metas`);
    lines.push(`  Qualitativas:  ${goals.filter(g => g.type === "QLT").length} metas`);
    lines.push(`  Documentais:   ${goals.filter(g => g.type === "DOC").length} metas`);
    lines.push(``);
    lines.push(`────────────────────────────────────────────────────`);
    lines.push(`  METAS COM MAIOR RISCO`);
    lines.push(`────────────────────────────────────────────────────`);
    lines.push(``);
    [...goals].sort((a, b) => b.risk - a.risk).slice(0, 5).forEach((g, i) => {
      lines.push(`  ${i + 1}. ${g.name} — Risco: ${formatFullCurrency(g.risk)} (${getGoalPct(g).toFixed(0)}% atingido)`);
    });
    lines.push(``);
  }

  lines.push(`════════════════════════════════════════════════════`);
  lines.push(`  Gerado automaticamente pelo SisLu`);
  lines.push(`  ${now}`);
  lines.push(`════════════════════════════════════════════════════`);

  return new Blob([lines.join("\n")], { type: "text/plain" });
}

/* ══════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════ */

const RelatoriosPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("4M");
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");

  // Contract & comparison
  const [selectedContractId, setSelectedContractId] = useState("c1");
  const [compareMode, setCompareMode] = useState(false);
  const [compareContractId, setCompareContractId] = useState("c2");

  // Filters
  const [typeFilter, setTypeFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("todas");

  // Carousel
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Report generation
  const [selectedType, setSelectedType] = useState("consolidado");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [reports, setReports] = useState(GENERATED_REPORTS);

  // Goal modal
  const [selectedGoal, setSelectedGoal] = useState<GoalItem | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  const contract = CONTRACTS.find(c => c.id === selectedContractId)!;
  const compareContract = CONTRACTS.find(c => c.id === compareContractId);

  const filteredGoals = useMemo(() => filterGoals(contract.goals, typeFilter, statusFilter), [contract, typeFilter, statusFilter]);
  const stats = useMemo(() => computeStats(filteredGoals), [filteredGoals]);

  const compareFilteredGoals = useMemo(() => compareContract ? filterGoals(compareContract.goals, typeFilter, statusFilter) : [], [compareContract, typeFilter, statusFilter]);
  const compareStats = useMemo(() => computeStats(compareFilteredGoals), [compareFilteredGoals]);

  const TOTAL_SLIDES = compareMode ? 7 : 6;

  const nextSlide = useCallback(() => setCurrentSlide(prev => (prev + 1) % TOTAL_SLIDES), [TOTAL_SLIDES]);
  const prevSlide = useCallback(() => setCurrentSlide(prev => (prev - 1 + TOTAL_SLIDES) % TOTAL_SLIDES), [TOTAL_SLIDES]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(nextSlide, 8000);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  useEffect(() => { setCurrentSlide(0); }, [selectedContractId, typeFilter, statusFilter, compareMode]);

  const handleGenerate = () => {
    const blob = generatePdfBlob(filteredGoals, contract.name, selectedType, includeCharts, includeDetails);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const reportLabel = REPORT_TYPES.find(t => t.id === selectedType)?.label || selectedType;
    const fileName = `SisLu_${reportLabel.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setReports(prev => [{ id: crypto.randomUUID(), name: `${reportLabel} — ${contract.unit}`, date: new Date().toLocaleDateString("pt-BR"), type: selectedType, size: `${(blob.size / 1024).toFixed(0)} KB` }, ...prev]);
    toast.success("Relatório gerado e baixado!", { description: fileName });
  };

  const handleDownloadReport = (report: typeof GENERATED_REPORTS[0]) => {
    const blob = generatePdfBlob(filteredGoals, contract.name, report.type, true, true);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `SisLu_${report.name.replace(/\s/g, "_")}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Download iniciado");
  };

  /* ── Build type distribution from filtered goals ── */
  const typeDist = useMemo(() => [
    { name: "Quantitativas", value: filteredGoals.filter(g => g.type === "QNT").length, color: "hsl(var(--primary))" },
    { name: "Qualitativas", value: filteredGoals.filter(g => g.type === "QLT").length, color: "hsl(var(--accent))" },
    { name: "Documentais", value: filteredGoals.filter(g => g.type === "DOC").length, color: "hsl(var(--muted-foreground))" },
  ].filter(d => d.value > 0), [filteredGoals]);

  /* ── Rubrica radar data ── */
  const rubricaRadar = useMemo(() => {
    return contract.rubricas.map(r => {
      const goalsInRubrica = filteredGoals.filter(g => g.rubrica === r.name);
      const avgPct = goalsInRubrica.length ? Math.round(goalsInRubrica.reduce((s, g) => s + getGoalPct(g), 0) / goalsInRubrica.length) : 100;
      return { rubrica: r.name, atingimento: avgPct, peso: r.pct };
    });
  }, [contract, filteredGoals]);

  /* ── Comparison bar data ── */
  const comparisonData = useMemo(() => {
    if (!compareMode || !compareContract) return [];
    return [
      { metric: "Atingimento %", [contract.unit]: stats.avg, [compareContract.unit]: compareStats.avg },
      { metric: "Metas atingidas", [contract.unit]: stats.atingidas, [compareContract.unit]: compareStats.atingidas },
      { metric: "Risco (R$k)", [contract.unit]: Math.round(stats.totalRisk / 1000), [compareContract.unit]: Math.round(compareStats.totalRisk / 1000) },
      { metric: "Críticas", [contract.unit]: stats.criticas, [compareContract.unit]: compareStats.criticas },
    ];
  }, [compareMode, contract, compareContract, stats, compareStats]);

  /* ── Financial impact by rubrica ── */
  const rubricaFinancial = useMemo(() => {
    return contract.rubricas.map(r => {
      const goalsInRubrica = filteredGoals.filter(g => g.rubrica === r.name);
      const riskInRubrica = goalsInRubrica.reduce((s, g) => s + g.risk, 0);
      return { name: r.name, valor: r.valor / 1000, risco: riskInRubrica / 1000, pct: r.pct };
    });
  }, [contract, filteredGoals]);

  /* ── Render slides ── */
  const renderSlide = (index: number) => {
    switch (index) {
      case 0: // KPIs
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">{contract.name}</h3>
            <p className="text-xs text-muted-foreground mb-4">Valor global: {formatFullCurrency(contract.valorGlobal)}/mês • {filteredGoals.length} metas filtradas</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="kpi-card"><p className="text-xs text-muted-foreground">Risco financeiro</p><p className="text-2xl font-bold text-destructive">{formatCurrency(stats.totalRisk)}</p><p className="text-[10px] text-muted-foreground">{((stats.totalRisk / contract.valorGlobal) * 100).toFixed(1)}% do contrato</p></div>
              <div className="kpi-card"><p className="text-xs text-muted-foreground">Atingimento médio</p><p className="text-2xl font-bold" style={{ color: stats.avg >= 90 ? "hsl(142 71% 45%)" : stats.avg >= 70 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))" }}>{stats.avg}%</p><p className="text-[10px] text-muted-foreground">{stats.atingidas} atingidas de {stats.total}</p></div>
              <div className="kpi-card"><p className="text-xs text-muted-foreground">Em alerta</p><p className="text-2xl font-bold" style={{ color: "hsl(38 92% 50%)" }}>{stats.parciais}</p><p className="text-[10px] text-muted-foreground">Entre 60% e 89%</p></div>
              <div className="kpi-card"><p className="text-xs text-muted-foreground">Críticas</p><p className="text-2xl font-bold text-destructive">{stats.criticas}</p><p className="text-[10px] text-muted-foreground">Abaixo de 60%</p></div>
            </div>
          </div>
        );
      case 1: // Performance evolution
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Evolução de desempenho</h3>
            <p className="text-xs text-muted-foreground mb-4">% de metas por status — {contract.unit}</p>
            <div className="bg-card rounded-lg border border-border p-5">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={contract.performance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="atingidas" stackId="1" stroke="hsl(142 71% 45%)" fill="hsl(142 71% 45% / 0.3)" name="Atingidas %" />
                  <Area type="monotone" dataKey="parciais" stackId="1" stroke="hsl(38 92% 50%)" fill="hsl(38 92% 50% / 0.3)" name="Parciais %" />
                  <Area type="monotone" dataKey="naoAtingidas" stackId="1" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.3)" name="Não atingidas %" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 2: // Risk trend
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Risco financeiro & glosas</h3>
            <p className="text-xs text-muted-foreground mb-4">Evolução mensal — {contract.unit}</p>
            <div className="bg-card rounded-lg border border-border p-5">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={contract.riskTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v: number) => formatFullCurrency(v as number)} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="risco" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} name="Risco" />
                  <Line type="monotone" dataKey="glosa" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={{ r: 4 }} name="Glosa" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 3: // Rubrica radar
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Atingimento por rubrica</h3>
            <p className="text-xs text-muted-foreground mb-4">Radar de desempenho vs peso orçamentário — {contract.unit}</p>
            <div className="bg-card rounded-lg border border-border p-5">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={rubricaRadar}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="rubrica" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="Atingimento %" dataKey="atingimento" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  <Radar name="Peso %" dataKey="peso" stroke="hsl(38 92% 50%)" fill="hsl(38 92% 50%)" fillOpacity={0.15} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 4: // Financial impact
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Impacto financeiro por rubrica</h3>
            <p className="text-xs text-muted-foreground mb-4">Valor alocado vs risco em R$ mil — {contract.unit}</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-card rounded-lg border border-border p-5">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={rubricaFinancial} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickFormatter={(v) => `${v}k`} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip formatter={(v: number) => `R$ ${v}k`} contentStyle={tooltipStyle} />
                    <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Valor alocado" />
                    <Bar dataKey="risco" fill="hsl(var(--destructive) / 0.7)" radius={[6, 6, 0, 0]} name="Risco" />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card rounded-lg border border-border p-5">
                <p className="text-xs text-muted-foreground mb-3">Distribuição por tipo</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={typeDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4}>
                      {typeDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      case 5: // Top risks
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Top riscos financeiros</h3>
            <p className="text-xs text-muted-foreground mb-4">Metas com maior impacto financeiro — {contract.unit}</p>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border grid grid-cols-12 text-xs font-medium text-muted-foreground">
                <span className="col-span-4">Meta</span><span className="col-span-2">Tipo</span><span className="col-span-2">Ating.</span><span className="col-span-2">Risco</span><span className="col-span-2">Peso</span>
              </div>
              {[...filteredGoals].sort((a, b) => b.risk - a.risk).slice(0, 6).map((g, i) => (
                <div key={g.id} className="px-5 py-3 grid grid-cols-12 items-center text-sm border-b border-border last:border-0">
                  <span className="col-span-4 font-medium text-foreground truncate">{g.name}</span>
                  <span className="col-span-2"><span className={`status-badge ${g.type === "QNT" ? "bg-primary/10 text-primary" : g.type === "QLT" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{g.type}</span></span>
                  <span className={`col-span-2 font-medium ${getGoalPct(g) >= 90 ? "text-emerald-600" : getGoalPct(g) >= 60 ? "text-amber-500" : "text-destructive"}`}>{getGoalPct(g).toFixed(0)}%</span>
                  <span className="col-span-2 text-destructive font-medium">{formatCurrency(g.risk)}</span>
                  <span className="col-span-2 text-muted-foreground">{g.pesoFinanceiro}%</span>
                </div>
              ))}
            </div>
          </div>
        );
      case 6: // Comparison (only in compare mode)
        if (!compareMode || !compareContract) return null;
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Comparativo entre contratos</h3>
            <p className="text-xs text-muted-foreground mb-4">{contract.unit} vs {compareContract.unit}</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-lg border border-border p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={comparisonData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey={contract.unit} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    <Bar dataKey={compareContract.unit} fill="hsl(38 92% 50%)" radius={[6, 6, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <div className="kpi-card"><p className="text-xs text-muted-foreground">{contract.unit} — Risco total</p><p className="text-xl font-bold text-destructive">{formatCurrency(stats.totalRisk)}</p></div>
                <div className="kpi-card"><p className="text-xs text-muted-foreground">{compareContract.unit} — Risco total</p><p className="text-xl font-bold" style={{ color: "hsl(38 92% 50%)" }}>{formatCurrency(compareStats.totalRisk)}</p></div>
                <div className="kpi-card"><p className="text-xs text-muted-foreground">Diferença de atingimento</p><p className="text-xl font-bold text-foreground">{stats.avg - compareStats.avg > 0 ? "+" : ""}{stats.avg - compareStats.avg}pp</p></div>
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          ← Voltar
        </Button>

        <PageHeader
          title="Relatórios & Dashboard"
          subtitle="Acompanhamento em tempo real de metas, riscos e desempenho"
          period={period} onPeriodChange={setPeriod}
          selectedUnit={selectedUnit} onUnitChange={setSelectedUnit}
        />

        {/* ─── FILTERS BAR ─── */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card rounded-lg border border-border">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Contrato</Label>
            <Select value={selectedContractId} onValueChange={setSelectedContractId}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTRACTS.map(c => <SelectItem key={c.id} value={c.id}>{c.name.split("—")[0].trim()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Tipo de meta</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os tipos</SelectItem>
                <SelectItem value="QNT">Quantitativas</SelectItem>
                <SelectItem value="QLT">Qualitativas</SelectItem>
                <SelectItem value="DOC">Documentais</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os status</SelectItem>
                <SelectItem value="atingidas">Atingidas (≥90%)</SelectItem>
                <SelectItem value="parciais">Parciais (60-89%)</SelectItem>
                <SelectItem value="criticas">Críticas (&lt;60%)</SelectItem>
                <SelectItem value="em_risco">Com risco financeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 ml-auto border-l border-border pl-4">
            <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor="compare-toggle">⇄ Comparar</Label>
            <Switch id="compare-toggle" checked={compareMode} onCheckedChange={setCompareMode} />
            <Switch id="compare-toggle" checked={compareMode} onCheckedChange={setCompareMode} />
            {compareMode && (
              <Select value={compareContractId} onValueChange={setCompareContractId}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACTS.filter(c => c.id !== selectedContractId).map(c => <SelectItem key={c.id} value={c.id}>{c.name.split("—")[0].trim()}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* ─── CAROUSEL ─── */}
        <div className="relative mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                <button key={i} onClick={() => setCurrentSlide(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === currentSlide ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"}`}
                />
              ))}
              <span className="text-[10px] text-muted-foreground ml-2">{currentSlide + 1}/{TOTAL_SLIDES}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => setIsPaused(!isPaused)}>
                {isPaused ? "▶" : "⏸"}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={prevSlide}>
                ←
              </Button>
              <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={nextSlide}>
                →
              </Button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={currentSlide} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.35 }}>
              {renderSlide(currentSlide)}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ─── METAS TABLE ─── */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-display font-semibold text-lg text-foreground">
              Metas do período <span className="text-sm font-normal text-muted-foreground">— {filteredGoals.length} resultado{filteredGoals.length !== 1 ? "s" : ""}</span>
            </h3>
          </div>

          <div className="bg-card rounded-lg border border-border">
            <div className="divide-y divide-border">
              {filteredGoals.map((goal, i) => (
                <GoalRow key={goal.id} goal={goal} index={i} onClick={() => { setSelectedGoal(goal); setGoalModalOpen(true); }} />
              ))}
              {filteredGoals.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma meta encontrada com os filtros selecionados.</p>
              )}
            </div>
          </div>
        </div>

        {/* ─── GERAR RELATÓRIO ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="kpi-card space-y-4">
              <h2 className="font-display font-semibold text-foreground">
                Gerar relatório
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
                Gerar e baixar PDF
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
                      Baixar PDF
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
