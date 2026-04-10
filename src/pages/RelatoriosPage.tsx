import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
    id: "c1", name: "Contrato de Gestão — Hospital Geral", unit: "Hospital Geral", valorGlobal: 2800000,
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
    id: "c2", name: "Contrato de Gestão — UPA Norte", unit: "UPA Norte", valorGlobal: 1200000,
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
    id: "c3", name: "Contrato de Gestão — UBS Centro", unit: "UBS Centro", valorGlobal: 680000,
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

/* ── PDF generation with jsPDF ── */
async function generatePdfBlob(
  goals: GoalItem[],
  contractName: string,
  type: string,
  includeCharts: boolean,
  includeDetails: boolean,
  contract: ContractData,
  chartCanvasRef: React.RefObject<HTMLDivElement | null>
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const reportLabel = REPORT_TYPES.find(t => t.id === type)?.label || type;
  const now = new Date().toLocaleDateString("pt-BR");
  const stats = computeStats(goals);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

   const PRIMARY = [35, 66, 117]; // hsl(214 55% 30%)
   const DARK = [30, 40, 50];
   const MUTED = [120, 130, 140];
   const RED = [220, 60, 60];
   const GREEN = [40, 160, 90];
   const AMBER = [230, 160, 30];
   const WHITE = [255, 255, 255];
   const LIGHT_BG = [235, 239, 245];

  /* ── Helper functions ── */
  const addNewPageIfNeeded = (needed: number) => {
    if (y + needed > H - 20) { doc.addPage(); y = margin; drawHeader(); }
  };

  const drawHeader = () => {
    doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.rect(0, 0, W, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("MOSS — Métricas para Organizações de Serviço Social", margin, 8);
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
    doc.text(`Página ${pageNum} de ${totalPages}`, W - margin, H - 4, { align: "right" });
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

  const drawPieSlice = (cx: number, cy: number, r: number, startAngle: number, endAngle: number, color: number[]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    const steps = 40;
    const points: number[][] = [[cx, cy]];
    for (let i = 0; i <= steps; i++) {
      const a = startAngle + (endAngle - startAngle) * (i / steps);
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    // Draw as filled polygon using lines
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    // Use triangle fan approach
    for (let i = 1; i < points.length - 1; i++) {
      doc.triangle(
        points[0][0], points[0][1],
        points[i][0], points[i][1],
        points[i+1][0], points[i+1][1],
        "F"
      );
    }
  };

  /* ═══ PAGE 1: Cover & Summary ═══ */
  // Header bar
  doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.rect(0, 0, W, 45, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("MOSS", margin, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Métricas para Organizações de Serviço Social", margin, 28);
  doc.setFontSize(9);
  doc.text(`${reportLabel}  |  ${now}`, margin, 38);
  y = 55;

  // Contract info card
  doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
  doc.roundedRect(margin, y, W - 2 * margin, 18, 3, 3, "F");
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(contractName, margin + 5, y + 7);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Valor global: ${formatFullCurrency(contract.valorGlobal)}/mês  •  ${goals.length} metas avaliadas`, margin + 5, y + 14);
  y += 25;

  // KPI cards row
  const cardW = (W - 2 * margin - 9) / 4;
  const kpis = [
    { label: "Risco financeiro", value: formatCurrency(stats.totalRisk), color: RED, sub: `${((stats.totalRisk / contract.valorGlobal) * 100).toFixed(1)}% do contrato` },
    { label: "Atingimento médio", value: `${stats.avg}%`, color: stats.avg >= 90 ? GREEN : stats.avg >= 70 ? AMBER : RED, sub: `${stats.atingidas} de ${stats.total} atingidas` },
    { label: "Em alerta", value: `${stats.parciais}`, color: AMBER, sub: "Entre 60% e 89%" },
    { label: "Críticas", value: `${stats.criticas}`, color: RED, sub: "Abaixo de 60%" },
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

  /* ═══ Charts section ═══ */
  if (includeCharts) {
    // Distribution by type - horizontal bars
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text("Distribuição por tipo de meta", margin, y);
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
      doc.setFontSize(7);
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text(`${item.val}`, margin + 34 + barWidth, y + 4);
      y += 8;
    });
    y += 4;

    // Pie chart - status distribution
    addNewPageIfNeeded(60);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text("Status das metas", margin, y);
    y += 5;

    const pieData = [
      { label: "Atingidas (≥90%)", val: stats.atingidas, color: GREEN },
      { label: "Parciais (60-89%)", val: stats.parciais, color: AMBER },
      { label: "Críticas (<60%)", val: stats.criticas, color: RED },
    ].filter(d => d.val > 0);

    const pieR = 18;
    const pieCx = margin + pieR + 5;
    const pieCy = y + pieR + 2;
    let startA = -Math.PI / 2;

    pieData.forEach(slice => {
      const sliceAngle = (slice.val / stats.total) * Math.PI * 2;
      drawPieSlice(pieCx, pieCy, pieR, startA, startA + sliceAngle, slice.color);
      startA += sliceAngle;
    });

    // Legend for pie
    let legendY = y + 4;
    pieData.forEach(item => {
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.rect(margin + pieR * 2 + 18, legendY, 4, 4, "F");
      doc.setFontSize(8);
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text(`${item.label}: ${item.val} (${((item.val / stats.total) * 100).toFixed(0)}%)`, margin + pieR * 2 + 25, legendY + 3.5);
      legendY += 7;
    });
    y += pieR * 2 + 10;

    // Risk bar chart by goal
    addNewPageIfNeeded(60);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text("Top riscos financeiros", margin, y);
    y += 6;

    const topRisks = [...goals].sort((a, b) => b.risk - a.risk).slice(0, 5);
    const maxRisk = Math.max(...topRisks.map(g => g.risk), 1);
    const riskBarW = W - 2 * margin - 65;

    topRisks.forEach((g, i) => {
      const pct = getGoalPct(g);
      const color = pct >= 90 ? GREEN : pct >= 60 ? AMBER : RED;
      doc.setFontSize(7);
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      const truncName = g.name.length > 25 ? g.name.substring(0, 25) + "..." : g.name;
      doc.text(truncName, margin, y + 4);
      drawBar(margin + 52, y, riskBarW, 5, (g.risk / maxRisk) * 100, color);
      doc.setFontSize(7);
      doc.setTextColor(RED[0], RED[1], RED[2]);
      doc.text(formatCurrency(g.risk), margin + 54 + riskBarW, y + 4);
      y += 8;
    });
    y += 6;

    // Rubrica allocation chart
    addNewPageIfNeeded(55);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text("Alocação por rubrica", margin, y);
    y += 6;

    const rubColors = [PRIMARY, GREEN, AMBER, [150, 100, 200], RED];
    contract.rubricas.forEach((r, i) => {
      const color = rubColors[i % rubColors.length];
      doc.setFontSize(7);
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      const rLabel = r.name.length > 20 ? r.name.substring(0, 20) + "..." : r.name;
      doc.text(rLabel, margin, y + 4);
      drawBar(margin + 40, y, W - 2 * margin - 65, 5, r.pct, color);
      doc.setFontSize(7);
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text(`${r.pct}%  (${formatCurrency(r.valor)})`, W - margin - 22, y + 4);
      y += 8;
    });
    y += 4;
  }

  /* ═══ Goals detail table ═══ */
  if (includeDetails) {
    addNewPageIfNeeded(30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text("Detalhamento por meta", margin, y);
    y += 4;

    const tableData = goals.map((g, i) => {
      const pct = getGoalPct(g).toFixed(0);
      return [
        `${i + 1}`,
        g.name,
        g.type,
        `${g.target}${g.unit}`,
        `${g.current}${g.unit}`,
        `${pct}%`,
        formatCurrency(g.risk),
        `${g.pesoFinanceiro}%`,
      ];
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
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 45 },
        2: { cellWidth: 12, halign: "center" },
        3: { cellWidth: 20, halign: "right" },
        4: { cellWidth: 20, halign: "right" },
        5: { cellWidth: 15, halign: "center" },
        6: { cellWidth: 22, halign: "right" },
        7: { cellWidth: 15, halign: "center" },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 5) {
          const val = parseFloat(data.cell.raw);
          if (val >= 90) data.cell.styles.textColor = GREEN;
          else if (val >= 60) data.cell.styles.textColor = AMBER;
          else data.cell.styles.textColor = RED;
          data.cell.styles.fontStyle = "bold";
        }
        if (data.section === "body" && data.column.index === 6) {
          const riskText = data.cell.raw as string;
          if (riskText !== "R$ 0k") data.cell.styles.textColor = RED;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Performance trend table
  addNewPageIfNeeded(30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.text("Evolução mensal de desempenho", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Mês", "Atingidas %", "Parciais %", "Não atingidas %"]],
    body: contract.performance.map(p => [p.month, `${p.atingidas}%`, `${p.parciais}%`, `${p.naoAtingidas}%`]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 3, lineColor: [220, 222, 226], lineWidth: 0.2 },
    headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles: { 0: { fontStyle: "bold" } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Risk trend table
  addNewPageIfNeeded(30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.text("Tendência de risco e glosa", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Mês", "Risco (R$)", "Glosa (R$)"]],
    body: contract.riskTrend.map(r => [r.month, formatFullCurrency(r.risco), formatFullCurrency(r.glosa)]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 3, lineColor: [220, 222, 226], lineWidth: 0.2 },
    headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 1) {
        data.cell.styles.textColor = RED;
      }
    },
  });

  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  return doc.output("blob");
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

  // Bed data from DB
  const [bedData, setBedData] = useState<{ facility_unit: string; category: string; specialty: string; quantity: number }[]>([]);
  const [bedGoalEntries, setBedGoalEntries] = useState<{ goal_name: string; facility_unit: string; period: string; value: number; target: number }[]>([]);

  useEffect(() => {
    const fetchBedData = async () => {
      const { data: beds } = await supabase.from("beds").select("*");
      if (beds) setBedData(beds);

      const { data: goals } = await supabase.from("goals").select("id, name, facility_unit, target");
      if (!goals) return;
      const bedGoals = goals.filter(g => {
        const n = g.name.toLowerCase();
        return n.includes("ocupa") || n.includes("intern") || n.includes("giro") || n.includes("rotat");
      });
      if (!bedGoals.length) return;

      const { data: entries } = await supabase.from("goal_entries").select("goal_id, value, period").in("goal_id", bedGoals.map(g => g.id));
      if (!entries) return;

      const mapped = entries.map(e => {
        const goal = bedGoals.find(g => g.id === e.goal_id)!;
        return { goal_name: goal.name, facility_unit: goal.facility_unit, period: e.period, value: Number(e.value), target: Number(goal.target) };
      });
      setBedGoalEntries(mapped);
    };
    fetchBedData();
  }, []);

  const contract = CONTRACTS.find(c => c.id === selectedContractId)!;
  const compareContract = CONTRACTS.find(c => c.id === compareContractId);

  const filteredGoals = useMemo(() => filterGoals(contract.goals, typeFilter, statusFilter), [contract, typeFilter, statusFilter]);
  const stats = useMemo(() => computeStats(filteredGoals), [filteredGoals]);

  const compareFilteredGoals = useMemo(() => compareContract ? filterGoals(compareContract.goals, typeFilter, statusFilter) : [], [compareContract, typeFilter, statusFilter]);
  const compareStats = useMemo(() => computeStats(compareFilteredGoals), [compareFilteredGoals]);

  // Bed chart data - filtered by selected contract unit
  const bedChartData = useMemo(() => {
    const unit = contract.unit;
    const totalInternacao = bedData.filter(b => b.facility_unit === unit && b.category === "internacao").reduce((s, b) => s + b.quantity, 0);
    const totalComplementar = bedData.filter(b => b.facility_unit === unit && b.category === "complementar").reduce((s, b) => s + b.quantity, 0);
    const totalLeitos = totalInternacao + totalComplementar;

    // Group entries by period for this unit
    const entriesByPeriod: Record<string, { internacoes: number; saidas: number }> = {};
    bedGoalEntries.filter(e => e.facility_unit === unit).forEach(e => {
      if (!entriesByPeriod[e.period]) entriesByPeriod[e.period] = { internacoes: 0, saidas: 0 };
      const n = e.goal_name.toLowerCase();
      if (n.includes("ocupa") || n.includes("intern")) {
        entriesByPeriod[e.period].internacoes += e.value;
      }
      if (n.includes("giro") || n.includes("rotat")) {
        entriesByPeriod[e.period].saidas += e.value;
      }
    });

    const periods = Object.keys(entriesByPeriod).sort();
    let accumulated = 0;
    const timeline = periods.map(p => {
      const d = entriesByPeriod[p];
      const taxaOcupacao = totalInternacao > 0 ? Math.round((d.internacoes / totalInternacao) * 100) : 0;
      const giro = totalInternacao > 0 ? parseFloat((d.internacoes / totalInternacao).toFixed(2)) : 0;
      accumulated += d.internacoes;
      return { period: p, taxaOcupacao, giro, internacoes: d.internacoes, leitos: totalInternacao };
    });

    return { totalInternacao, totalComplementar, totalLeitos, timeline, 
      bedBreakdown: bedData.filter(b => b.facility_unit === unit) };
  }, [contract.unit, bedData, bedGoalEntries]);

  const chartRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isCarouselFullscreen, setIsCarouselFullscreen] = useState(false);

  const hasBedData = bedChartData.totalLeitos > 0;
  const TOTAL_SLIDES = (compareMode ? 11 : 10) + (hasBedData ? 2 : 0);
  const FULLSCREEN_GROUPS = useMemo(() => {
    const groups: number[][] = [[0, 9], [1, 2], [3, 4], [5, 6], [7, 8]];
    if (hasBedData) groups.push([10, 11]);
    const compIdx = hasBedData ? 12 : 10;
    if (compareMode) groups.push([compIdx]);
    return groups;
  }, [compareMode, hasBedData]);
  const TOTAL_FS_SLIDES = FULLSCREEN_GROUPS.length;

  const nextSlide = useCallback(() => setCurrentSlide(prev => {
    const total = isCarouselFullscreen ? TOTAL_FS_SLIDES : TOTAL_SLIDES;
    return (prev + 1) % total;
  }), [TOTAL_SLIDES, TOTAL_FS_SLIDES, isCarouselFullscreen]);
  const prevSlide = useCallback(() => setCurrentSlide(prev => {
    const total = isCarouselFullscreen ? TOTAL_FS_SLIDES : TOTAL_SLIDES;
    return (prev - 1 + total) % total;
  }), [TOTAL_SLIDES, TOTAL_FS_SLIDES, isCarouselFullscreen]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(nextSlide, 8000);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  useEffect(() => { setCurrentSlide(0); }, [selectedContractId, typeFilter, statusFilter, compareMode]);

  const toggleCarouselFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      carouselRef.current?.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsCarouselFullscreen(fs);
      setCurrentSlide(0); // reset to avoid out-of-bounds
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleGenerate = async () => {
    const reportLabel = REPORT_TYPES.find(t => t.id === selectedType)?.label || selectedType;
    toast.info("Gerando PDF...");
    try {
      const blob = await generatePdfBlob(filteredGoals, contract.name, selectedType, includeCharts, includeDetails, contract, chartRef);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fileName = `MOSS_${reportLabel.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setReports(prev => [{ id: crypto.randomUUID(), name: `${reportLabel} — ${contract.unit}`, date: new Date().toLocaleDateString("pt-BR"), type: selectedType, size: `${(blob.size / 1024).toFixed(0)} KB` }, ...prev]);
      toast.success("Relatório PDF gerado!", { description: fileName });
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Erro ao gerar PDF: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDownloadReport = async (report: typeof GENERATED_REPORTS[0]) => {
    toast.info("Gerando PDF...");
    try {
      const blob = await generatePdfBlob(filteredGoals, contract.name, report.type, true, true, contract, chartRef);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `MOSS_${report.name.replace(/\s/g, "_")}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download iniciado");
    } catch (err) {
      console.error("PDF download error:", err);
      toast.error("Erro ao gerar PDF: " + (err instanceof Error ? err.message : String(err)));
    }
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
  const chartH = isCarouselFullscreen ? 420 : 280;
  const chartHSmall = isCarouselFullscreen ? 380 : 260;
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
               <ResponsiveContainer width="100%" height={chartH}>
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
               <ResponsiveContainer width="100%" height={chartH}>
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
               <ResponsiveContainer width="100%" height={chartH}>
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
                <ResponsiveContainer width="100%" height={chartHSmall}>
                  <BarChart data={rubricaFinancial} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickFormatter={(v) => `${v}k`} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip formatter={(v: number) => `R$ ${v}k`} contentStyle={tooltipStyle} />
                    <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Valor alocado" label={{ position: "top", fontSize: 10, fill: "hsl(var(--muted-foreground))", formatter: (v: number) => `${v.toFixed(0)}k` }} />
                    <Bar dataKey="risco" fill="hsl(var(--destructive) / 0.7)" radius={[6, 6, 0, 0]} name="Risco" label={{ position: "top", fontSize: 10, fill: "hsl(var(--destructive))", formatter: (v: number) => v > 0 ? `${v.toFixed(0)}k` : "" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card rounded-lg border border-border p-5">
                <p className="text-xs text-muted-foreground mb-3">Distribuição por tipo</p>
                <ResponsiveContainer width="100%" height={isCarouselFullscreen ? 300 : 220}>
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
      case 6: // Individual goal attainment bars
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Atingimento individual por meta</h3>
            <p className="text-xs text-muted-foreground mb-4">% realizado vs meta pactuada — {contract.unit}</p>
            <div className="bg-card rounded-lg border border-border p-5">
              <ResponsiveContainer width="100%" height={Math.max(isCarouselFullscreen ? 420 : 280, filteredGoals.length * 40)}>
                <BarChart data={filteredGoals.map(g => ({ name: g.name.length > 25 ? g.name.slice(0, 25) + "…" : g.name, pct: Math.round(getGoalPct(g)), meta: 100 }))} layout="vertical" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" domain={[0, 110]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="pct" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} name="Realizado" label={{ position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))", formatter: (v: number) => `${v}%` }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 7: // Risk distribution per goal
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Distribuição de risco por meta</h3>
            <p className="text-xs text-muted-foreground mb-4">Impacto financeiro individual — {contract.unit}</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-lg border border-border p-5">
                 <ResponsiveContainer width="100%" height={chartH}>
                  <PieChart>
                    <Pie data={filteredGoals.filter(g => g.risk > 0).map(g => ({ name: g.name.length > 20 ? g.name.slice(0, 20) + "…" : g.name, value: g.risk }))} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                      {filteredGoals.filter(g => g.risk > 0).map((_, i) => <Cell key={i} fill={["hsl(var(--destructive))", "hsl(38 92% 50%)", "hsl(var(--primary))", "hsl(280 70% 50%)", "hsl(190 80% 45%)", "hsl(340 75% 55%)", "hsl(160 60% 40%)", "hsl(25 85% 55%)"][i % 8]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatFullCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {[...filteredGoals].sort((a, b) => b.risk - a.risk).filter(g => g.risk > 0).map(g => {
                  const pct = stats.totalRisk > 0 ? (g.risk / stats.totalRisk * 100) : 0;
                  return (
                    <div key={g.id} className="flex items-center gap-3">
                      <span className="text-xs text-foreground w-40 truncate">{g.name}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-destructive/70 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-destructive w-16 text-right">{formatCurrency(g.risk)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      case 8: // Meta vs Realizado
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Meta vs Realizado</h3>
            <p className="text-xs text-muted-foreground mb-4">Comparação direta entre valor pactuado e alcançado — {contract.unit}</p>
            <div className="bg-card rounded-lg border border-border p-5">
              <ResponsiveContainer width="100%" height={isCarouselFullscreen ? 400 : 300}>
                <BarChart data={filteredGoals.map(g => ({ name: g.name.length > 18 ? g.name.slice(0, 18) + "…" : g.name, meta: g.target, realizado: g.current, unidade: g.unit }))} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} angle={-25} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="meta" fill="hsl(var(--muted-foreground) / 0.3)" radius={[6, 6, 0, 0]} name="Meta" label={{ position: "top", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <Bar dataKey="realizado" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Realizado" label={{ position: "top", fontSize: 9, fill: "hsl(var(--primary))" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 9: // Executive summary
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Resumo executivo</h3>
            <p className="text-xs text-muted-foreground mb-4">Visão consolidada do contrato — {contract.unit}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="kpi-card"><p className="text-xs text-muted-foreground">Valor do contrato</p><p className="text-xl font-bold text-foreground">{formatFullCurrency(contract.valorGlobal)}</p><p className="text-[10px] text-muted-foreground">Mensal</p></div>
              <div className="kpi-card"><p className="text-xs text-muted-foreground">Total em risco</p><p className="text-xl font-bold text-destructive">{formatCurrency(stats.totalRisk)}</p><p className="text-[10px] text-muted-foreground">{((stats.totalRisk / contract.valorGlobal) * 100).toFixed(1)}% do valor</p></div>
              <div className="kpi-card"><p className="text-xs text-muted-foreground">Glosa estimada</p><p className="text-xl font-bold" style={{ color: "hsl(38 92% 50%)" }}>{formatCurrency(contract.riskTrend[contract.riskTrend.length - 1]?.glosa || 0)}</p><p className="text-[10px] text-muted-foreground">Último mês</p></div>
              <div className="kpi-card"><p className="text-xs text-muted-foreground">Tendência de risco</p><p className="text-xl font-bold" style={{ color: contract.riskTrend.length >= 2 && contract.riskTrend[contract.riskTrend.length - 1].risco < contract.riskTrend[contract.riskTrend.length - 2].risco ? "hsl(142 71% 45%)" : "hsl(var(--destructive))" }}>{contract.riskTrend.length >= 2 && contract.riskTrend[contract.riskTrend.length - 1].risco < contract.riskTrend[contract.riskTrend.length - 2].risco ? "↓ Queda" : "↑ Alta"}</p><p className="text-[10px] text-muted-foreground">vs mês anterior</p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Status das metas</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden flex">
                    <div className="h-full" style={{ width: `${(stats.atingidas / stats.total) * 100}%`, background: "hsl(142 71% 45%)" }} />
                    <div className="h-full" style={{ width: `${(stats.parciais / stats.total) * 100}%`, background: "hsl(38 92% 50%)" }} />
                    <div className="h-full" style={{ width: `${(stats.criticas / stats.total) * 100}%`, background: "hsl(var(--destructive))" }} />
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(142 71% 45%)" }} />{stats.atingidas} atingidas</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(38 92% 50%)" }} />{stats.parciais} parciais</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" />{stats.criticas} críticas</span>
                </div>
              </div>
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Rubricas com maior risco</p>
                {contract.rubricas.slice(0, 3).map(r => {
                  const riskInR = filteredGoals.filter(g => g.rubrica === r.name).reduce((s, g) => s + g.risk, 0);
                  return (
                    <div key={r.name} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                      <span className="text-foreground">{r.name}</span>
                      <span className="text-destructive font-medium">{riskInR > 0 ? formatCurrency(riskInR) : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      case 10: // Bed occupancy & capacity
        if (!hasBedData) {
          // fallback to comparison if no bed data
          if (!compareMode || !compareContract) return null;
          return renderComparisonSlide();
        }
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Capacidade & Taxa de Ocupação de Leitos</h3>
            <p className="text-xs text-muted-foreground mb-4">Distribuição de leitos e ocupação por período — {contract.unit}</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-lg border border-border p-5">
                <div className="flex items-center gap-4 mb-3">
                  <p className="text-xs font-medium text-muted-foreground">Leitos de Internação</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{bedChartData.totalInternacao} leitos</span>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(120, bedChartData.bedBreakdown.filter(b => b.category === "internacao").length * 28)}>
                  <BarChart data={bedChartData.bedBreakdown.filter(b => b.category === "internacao").map(b => ({ name: b.specialty.length > 20 ? b.specialty.slice(0, 20) + "…" : b.specialty, leitos: b.quantity }))} layout="vertical" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <defs>
                      <linearGradient id="gradientBarInternacao" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="hsl(210 80% 55%)" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <Bar dataKey="leitos" fill="url(#gradientBarInternacao)" radius={[0, 8, 8, 0]} name="Leitos" label={{ position: "right", fontSize: 10, fill: "hsl(var(--foreground))", fontWeight: 600 }} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mb-3 mt-5">
                  <p className="text-xs font-medium text-muted-foreground">Leitos Complementares</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/60 text-accent-foreground font-semibold">{bedChartData.totalComplementar} leitos</span>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(120, bedChartData.bedBreakdown.filter(b => b.category === "complementar").length * 28)}>
                  <BarChart data={bedChartData.bedBreakdown.filter(b => b.category === "complementar").map(b => ({ name: b.specialty.length > 20 ? b.specialty.slice(0, 20) + "…" : b.specialty, leitos: b.quantity }))} layout="vertical" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <defs>
                      <linearGradient id="gradientBarComplementar" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(35 90% 55%)" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="hsl(35 90% 65%)" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <Bar dataKey="leitos" fill="url(#gradientBarComplementar)" radius={[0, 8, 8, 0]} name="Leitos" label={{ position: "right", fontSize: 10, fill: "hsl(var(--foreground))", fontWeight: 600 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="kpi-card">
                    <p className="text-[10px] text-muted-foreground">Internação</p>
                    <p className="text-2xl font-bold text-primary">{bedChartData.totalInternacao}</p>
                    <p className="text-[10px] text-muted-foreground">leitos</p>
                  </div>
                  <div className="kpi-card">
                    <p className="text-[10px] text-muted-foreground">Complementar</p>
                    <p className="text-2xl font-bold" style={{ color: "hsl(210 80% 55%)" }}>{bedChartData.totalComplementar}</p>
                    <p className="text-[10px] text-muted-foreground">leitos</p>
                  </div>
                </div>
                {bedChartData.timeline.length > 0 ? (
                  <div className="bg-card rounded-lg border border-border p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Taxa de Ocupação por período</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={bedChartData.timeline}>
                        <defs>
                          <linearGradient id="gradOcupacao" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="period" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}%`} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                        <Area type="monotone" dataKey="taxaOcupacao" stroke="hsl(142 71% 45%)" strokeWidth={2.5} fill="url(#gradOcupacao)" name="Taxa de Ocupação %" dot={{ r: 4, fill: "hsl(142 71% 45%)", strokeWidth: 2, stroke: "#fff" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="bg-card rounded-lg border border-border p-6 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Nenhum lançamento registrado para esta unidade</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 11: // Bed turnover (giro)
        if (!hasBedData) {
          if (!compareMode || !compareContract) return null;
          return renderComparisonSlide();
        }
        return (
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Giro de Leitos & Internações</h3>
            <p className="text-xs text-muted-foreground mb-4">Rotatividade e volume de internações por período — {contract.unit}</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-lg border border-border p-5">
                <p className="text-xs font-medium text-muted-foreground mb-3">Volume de internações por período</p>
                {bedChartData.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={chartH}>
                    <BarChart data={bedChartData.timeline} barGap={4}>
                      <defs>
                        <linearGradient id="gradInternacoes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="period" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="internacoes" fill="url(#gradInternacoes)" radius={[8, 8, 0, 0]} name="Internações" label={{ position: "top", fontSize: 10, fill: "hsl(var(--foreground))", fontWeight: 600 }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px]">
                    <p className="text-sm text-muted-foreground">Sem lançamentos</p>
                  </div>
                )}
              </div>
              <div className="bg-card rounded-lg border border-border p-5">
                <p className="text-xs font-medium text-muted-foreground mb-3">Giro de leitos (rotatividade)</p>
                {bedChartData.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={chartH}>
                    <LineChart data={bedChartData.timeline}>
                      <defs>
                        <linearGradient id="gradGiro" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="period" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={[0, 'auto']} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(2)} />
                      <Line type="monotone" dataKey="giro" stroke="hsl(38 92% 50%)" strokeWidth={3} name="Giro" dot={{ r: 5, fill: "hsl(38 92% 50%)", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px]">
                    <p className="text-sm text-muted-foreground">Sem lançamentos</p>
                  </div>
                )}
              </div>
            </div>
            {bedChartData.totalLeitos > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="kpi-card">
                  <p className="text-[10px] text-muted-foreground">Total de leitos</p>
                  <p className="text-xl font-bold text-foreground">{bedChartData.totalLeitos}</p>
                </div>
                <div className="kpi-card">
                  <p className="text-[10px] text-muted-foreground">Leitos internação</p>
                  <p className="text-xl font-bold text-primary">{bedChartData.totalInternacao}</p>
                </div>
                <div className="kpi-card">
                  <p className="text-[10px] text-muted-foreground">Leitos complementares</p>
                  <p className="text-xl font-bold" style={{ color: "hsl(210 80% 55%)" }}>{bedChartData.totalComplementar}</p>
                </div>
              </div>
            )}
          </div>
        );
      case (hasBedData ? 12 : 10): // Comparison (only in compare mode)
        if (!compareMode || !compareContract) return null;
        return renderComparisonSlide();
      default: return null;
    }
  };

  const renderComparisonSlide = () => {
    if (!compareContract) return null;
    return (
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">Comparativo entre contratos</h3>
        <p className="text-xs text-muted-foreground mb-4">{contract.unit} vs {compareContract.unit}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-lg border border-border p-5">
            <ResponsiveContainer width="100%" height={chartH}>
              <BarChart data={comparisonData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey={contract.unit} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} label={{ position: "top", fontSize: 10, fill: "hsl(var(--primary))" }} />
                <Bar dataKey={compareContract.unit} fill="hsl(38 92% 50%)" radius={[6, 6, 0, 0]} label={{ position: "top", fontSize: 10, fill: "hsl(38 92% 50%)" }} />
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
  };

  const renderFullscreenSlide = (groupIndex: number) => {
    const group = FULLSCREEN_GROUPS[groupIndex];
    if (!group) return null;
    if (group.length === 1) return renderSlide(group[0]);
    // Pair two charts side by side
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full items-start">
        <div className="min-h-0">{renderSlide(group[0])}</div>
        <div className="min-h-0">{renderSlide(group[1])}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          Voltar
        </Button>

        <div className="mb-6">
          <h1 className="font-display text-xl font-bold text-foreground">Relatórios & Dashboard</h1>
          <p className="text-sm text-muted-foreground">Acompanhamento em tempo real de metas, riscos e desempenho</p>
        </div>

        {/* ─── FILTERS BAR ─── */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card rounded-lg border border-border">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Contrato</Label>
            <Select value={selectedContractId} onValueChange={setSelectedContractId}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTRACTS.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
            {compareMode && (
              <Select value={compareContractId} onValueChange={setCompareContractId}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACTS.filter(c => c.id !== selectedContractId).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* ─── CAROUSEL ─── */}
        <div ref={carouselRef} className={`relative mb-8 ${isCarouselFullscreen ? "fixed inset-0 z-[9999] bg-background px-8 py-6 overflow-auto flex flex-col" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {Array.from({ length: isCarouselFullscreen ? TOTAL_FS_SLIDES : TOTAL_SLIDES }).map((_, i) => (
                <button key={i} onClick={() => setCurrentSlide(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === currentSlide ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"}`}
                />
              ))}
              <span className="text-[10px] text-muted-foreground ml-2">{currentSlide + 1}/{isCarouselFullscreen ? TOTAL_FS_SLIDES : TOTAL_SLIDES}</span>
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
              <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={toggleCarouselFullscreen}>
                {isCarouselFullscreen ? "✕ Sair" : "⛶ Tela cheia"}
              </Button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={currentSlide} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.35 }}
              className={isCarouselFullscreen ? "flex-1" : ""}>
              {isCarouselFullscreen ? renderFullscreenSlide(currentSlide) : renderSlide(currentSlide)}
            </motion.div>
          </AnimatePresence>

          {isCarouselFullscreen && !isPaused && (
            <div className="h-1 bg-muted mt-4 rounded-full overflow-hidden">
              <motion.div key={currentSlide} className="h-full bg-primary rounded-full" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 8, ease: "linear" }} />
            </div>
          )}
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
