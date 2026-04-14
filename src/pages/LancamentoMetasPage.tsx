import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useContracts } from "@/contexts/ContractsContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format, endOfMonth, isWithinInterval, parse, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import GoalGauge from "@/components/GoalGauge";
import BedMovementsTab from "@/components/BedMovementsTab";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PdfExportModal from "@/components/PdfExportModal";

/* ── Types ────────────────────────────────────── */
interface Goal {
  id: string;
  name: string;
  target: number;
  unit: string;
  type: string;
  weight: number;
  risk: number;
  facility_unit: string;
  start_date?: string | null;
  end_date?: string | null;
}

interface EntryForm {
  value: string;
  period: string;
  notes: string;
}

/* ── Rubrica helpers ──────────────────────────── */
const formatCurrency = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
};
const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };
const PIE_COLORS = ["hsl(var(--primary))", "hsl(38 92% 50%)", "hsl(142 71% 45%)", "hsl(280 70% 50%)", "hsl(var(--destructive))", "hsl(190 80% 45%)"];

/* ── Component ────────────────────────────────── */
const LancamentoMetasPage = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin: isAdminRole } = useAuth();
  const [activeTab, setActiveTab] = useState("lancar-metas");

  /* ── Metas state ── */
  const [goals, setGoals] = useState<Goal[]>([]);
  const [entries, setEntries] = useState<Record<string, EntryForm>>({});
  const [existingEntries, setExistingEntries] = useState<Record<string, { value: number; period: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const [filterYear, setFilterYear] = useState<string>(String(currentYear));
  const [filterMonth, setFilterMonth] = useState<string>(String(currentMonth));
  const FILTER_YEARS = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));
  const FILTER_MONTHS = [
    { value: "todos", label: "Todos" },
    { value: "0", label: "Janeiro" }, { value: "1", label: "Fevereiro" }, { value: "2", label: "Março" },
    { value: "3", label: "Abril" }, { value: "4", label: "Maio" }, { value: "5", label: "Junho" },
    { value: "6", label: "Julho" }, { value: "7", label: "Agosto" }, { value: "8", label: "Setembro" },
    { value: "9", label: "Outubro" }, { value: "10", label: "Novembro" }, { value: "11", label: "Dezembro" },
  ];
  const [bedData, setBedData] = useState<{ category: string; specialty: string; quantity: number }[]>([]);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [heatmapCompare, setHeatmapCompare] = useState<"global" | "meta">("global");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [filterType, setFilterType] = useState<string>("todos");
  const [filterGoal, setFilterGoal] = useState<string>("todos");
  const UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];

  const totalBedsByCategory = useMemo(() => {
    const internacao = bedData.filter(b => b.category === "internacao").reduce((s, b) => s + b.quantity, 0);
    const complementar = bedData.filter(b => b.category === "complementar").reduce((s, b) => s + b.quantity, 0);
    return { internacao, complementar, total: internacao + complementar };
  }, [bedData]);

  const isBedRelatedGoal = (name: string) => {
    const lower = name.toLowerCase();
    return lower.includes("ocupação") || lower.includes("internação") || lower.includes("internacao") || lower.includes("rotatividade") || lower.includes("leito");
  };

  const getDateRange = (): { start: Date; end: Date } | null => {
    const year = Number(filterYear);
    if (filterMonth === "todos") {
      return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59) };
    }
    const month = Number(filterMonth);
    return { start: new Date(year, month, 1), end: endOfMonth(new Date(year, month, 1)) };
  };

  const filterEntriesByDate = (entryList: { value: number; period: string }[]) => {
    const range = getDateRange();
    if (!range) return entryList;
    return entryList.filter(e => {
      try {
        const d = parse(e.period, "dd/MM/yyyy", new Date());
        return isWithinInterval(d, range);
      } catch { return true; }
    });
  };

  const handleGeneratePdf = async (sections: { metas: boolean; rubricas: boolean; leitos: boolean; mapaTermico: boolean }) => {
    setPdfGenerating(true);
    setPdfModalOpen(false);
    try {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const primary: [number, number, number] = [35, 66, 117];
    const success: [number, number, number] = [46, 160, 67];
    const warning: [number, number, number] = [41, 128, 185];
    const danger: [number, number, number] = [231, 76, 60];
    const lightBg: [number, number, number] = [235, 239, 245];
    const now = new Date();
    const margin = 12;
    const contentW = pageW - margin * 2;
    let pageNum = 0;

    const monthLabel = filterMonth === "todos" ? "Todos os meses" : FILTER_MONTHS.find(m => m.value === filterMonth)?.label || "";
    const filterLabel = `${filterYear} — ${monthLabel}`;

    const addHeader = (title: string) => {
      pageNum++;
      if (pageNum > 1) doc.addPage();
      doc.setFillColor(...primary);
      doc.rect(0, 0, pageW, 32, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text("MOSS", margin, 14);
      doc.setFontSize(8);
      doc.text("Métricas para Organizações de Serviço Social", margin, 21);
      doc.setFontSize(10);
      doc.text(title, margin, 29);
      doc.setFontSize(7);
      doc.text(`${selectedUnit} - ${format(now, "dd/MM/yyyy HH:mm")} - Filtro: ${filterLabel}`, pageW - margin, 29, { align: "right" });
      return 38;
    };

    const addFooter = () => {
      doc.setDrawColor(200, 210, 220);
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(6);
      doc.text("MOSS — Métricas para Organizações de Serviço Social", margin, pageH - 7);
      doc.text(`Página ${pageNum}`, pageW - margin, pageH - 7, { align: "right" });
    };

    const drawKpiBoxes = (kpis: { label: string; value: string; color?: [number, number, number] }[], y: number, cols = 4) => {
      const gap = 4;
      const boxW = (contentW - gap * (cols - 1)) / cols;
      kpis.forEach((kpi, i) => {
        const x = margin + i * (boxW + gap);
        doc.setFillColor(...lightBg);
        doc.roundedRect(x, y, boxW, 18, 2, 2, "F");
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(7);
        doc.text(kpi.label, x + 3, y + 6);
        doc.setTextColor(...(kpi.color || primary));
        doc.setFontSize(13);
        doc.text(kpi.value, x + 3, y + 15);
      });
      return y + 22;
    };

    const drawSectionTitle = (title: string, y: number) => {
      doc.setFillColor(...primary);
      doc.roundedRect(margin, y, contentW, 8, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(title, margin + 4, y + 5.5);
      return y + 11;
    };

    // ═══ PAGE: METAS ═══
    if (sections.metas) {
    let startY = addHeader("Relatório de Lançamentos — Metas");

    const metaRows = goals.map(g => {
      const existing = filterEntriesByDate(existingEntries[g.id] || []);
      const total = existing.reduce((s, e) => s + e.value, 0);
      const pct = g.target > 0 ? Math.round((total / g.target) * 100) : 0;
      const remaining = Math.max(0, g.target - total);
      return { name: g.name, target: g.target, unit: g.unit, total, pct, weight: g.weight, remaining, entries: existing.length };
    });
    const totalPct = metaRows.length > 0 ? Math.round(metaRows.reduce((s, r) => s + r.pct * r.weight, 0) / Math.max(metaRows.reduce((s, r) => s + r.weight, 0), 0.01)) : 0;
    const totalWeight = metaRows.reduce((s, r) => s + r.weight, 0);

    startY = drawKpiBoxes([
      { label: "Total de Metas", value: String(metaRows.length) },
      { label: "Atingimento Ponderado", value: `${totalPct}%`, color: totalPct >= 100 ? success : totalPct >= 70 ? warning : danger },
      { label: "Metas >= 100%", value: String(metaRows.filter(r => r.pct >= 100).length), color: success },
      { label: "Metas < 70%", value: String(metaRows.filter(r => r.pct < 70).length), color: metaRows.filter(r => r.pct < 70).length > 0 ? danger : success },
    ], startY);

    startY = drawKpiBoxes([
      { label: "Total Lançamentos", value: String(metaRows.reduce((s, r) => s + r.entries, 0)) },
      { label: "Peso Total", value: `${(totalWeight * 100).toFixed(0)}%` },
      { label: "Melhor Meta", value: metaRows.length > 0 ? `${Math.max(...metaRows.map(r => r.pct))}%` : "—", color: success },
      { label: "Pior Meta", value: metaRows.length > 0 ? `${Math.min(...metaRows.map(r => r.pct))}%` : "—", color: danger },
    ], startY);

    startY = drawSectionTitle("Atingimento por Meta (%)", startY);
    const barAreaW = contentW - 55;
    const barH2 = metaRows.length > 0 ? Math.min(8, 40 / metaRows.length) : 8;
    metaRows.forEach((r, i) => {
      const y = startY + i * (barH2 + 2);
      const barX = margin + 50;
      doc.setFillColor(220, 225, 230);
      doc.roundedRect(barX, y, barAreaW, barH2, 1, 1, "F");
      const fillW = Math.min(Math.min(r.pct / 100, 1.2) * barAreaW, barAreaW);
      doc.setFillColor(...(r.pct >= 100 ? success : r.pct >= 70 ? warning : danger));
      doc.roundedRect(barX, y, Math.max(fillW, 2), barH2, 1, 1, "F");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(7);
      doc.text(r.name.substring(0, 22), margin + 2, y + barH2 - 2);
      doc.setFontSize(7);
      doc.text(`${r.pct}%`, barX + barAreaW + 2, y + barH2 - 2);
    });
    startY += metaRows.length * (barH2 + 2) + 4;

    autoTable(doc, {
      startY,
      head: [["Meta", "Tipo", "Alvo", "Realizado", "Faltam", "Atingimento", "Peso", "Lançam."]],
      body: metaRows.map(r => [
         r.name, r.unit, `${r.target} ${r.unit}`, `${r.total.toFixed(1)} ${r.unit}`,
        `${r.remaining.toFixed(1)} ${r.unit}`, `${r.pct}%`, `${(r.weight * 100).toFixed(0)}%`, String(r.entries),
      ]),
      headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, textColor: [40, 40, 40], cellPadding: 2 },
      alternateRowStyles: { fillColor: lightBg },
      styles: { lineWidth: 0.1, lineColor: [200, 210, 220] },
      margin: { left: margin, right: margin },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 5) {
          const val = parseInt(data.cell.text[0]);
          if (val >= 100) data.cell.styles.textColor = success;
          else if (val < 70) data.cell.styles.textColor = danger;
        }
      },
    });

    const lastTableY = (doc as any).lastAutoTable?.finalY || startY + 40;
    if (lastTableY < pageH - 50 && totalBedsByCategory.total > 0) {
      let bedY = lastTableY + 6;
      bedY = drawSectionTitle("Capacidade de Leitos — " + selectedUnit, bedY);
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(8);
      doc.text(`Internacao: ${totalBedsByCategory.internacao} leitos  |  Complementar: ${totalBedsByCategory.complementar} leitos  |  Total: ${totalBedsByCategory.total} leitos`, margin + 2, bedY + 4);
      bedData.forEach((b, i) => {
        const x = margin + 2 + (i % 3) * (contentW / 3);
        const row = Math.floor(i / 3);
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(`${b.specialty}: ${b.quantity} (${b.category === "internacao" ? "Int." : "Comp."})`, x, bedY + 12 + row * 5);
      });
    }
    addFooter();
    } // end metas

    // ═══ PAGE: RUBRICAS ═══
    if (sections.rubricas) {
    let startY = addHeader("Relatório de Lançamentos — Rubricas");

    const contract = realContracts.find(c => c.id === selectedContract);
    if (contract) {
      const rubNames = (contract.rubricas || []).filter(r => r.percent > 0).map(r => r.name);
      const rubRows = rubNames.map(r => {
        const allocated = contract.value * ((contract.rubricas || []).find(rb => rb.name === r)?.percent || 0) / 100;
        const executed = savedRubricaEntries.filter(e => e.rubrica_name === r).reduce((s: number, e: any) => s + Number(e.value_executed), 0);
        const pct = allocated > 0 ? Math.round((executed / allocated) * 100) : 0;
        const saldo = allocated - executed;
        return { name: r, alloc: allocated, exec: executed, pct, saldo };
      });
      const totalAlloc = rubRows.reduce((s, r) => s + r.alloc, 0);
      const totalExec = rubRows.reduce((s, r) => s + r.exec, 0);
      const avgPct = totalAlloc > 0 ? Math.round((totalExec / totalAlloc) * 100) : 0;
      const totalSaldo = totalAlloc - totalExec;

      startY = drawKpiBoxes([
        { label: "Total Alocado", value: formatCurrency(totalAlloc) },
        { label: "Total Executado", value: formatCurrency(totalExec) },
        { label: "Execução Geral", value: `${avgPct}%`, color: avgPct > 100 ? danger : avgPct >= 80 ? success : warning },
        { label: "Saldo Disponível", value: formatCurrency(totalSaldo), color: totalSaldo < 0 ? danger : success },
      ], startY);

      startY = drawKpiBoxes([
        { label: "Rubricas Estouradas", value: String(rubRows.filter(r => r.pct > 100).length), color: rubRows.filter(r => r.pct > 100).length > 0 ? danger : success },
        { label: "Maior Execução", value: `${Math.max(...rubRows.map(r => r.pct))}%` },
        { label: "Menor Execução", value: `${Math.min(...rubRows.map(r => r.pct))}%` },
        { label: "Contrato", value: contract.unit.substring(0, 12) },
      ], startY);

      startY = drawSectionTitle("Execução por Rubrica (%)", startY);
      const colors: [number, number, number][] = [[26, 54, 71], [41, 128, 185], [46, 160, 67], [142, 68, 173], [231, 76, 60], [52, 152, 219]];
      const rubBarW = contentW - 55;
      rubRows.forEach((r, i) => {
        const y = startY + i * 7;
        const barX = margin + 50;
        doc.setFillColor(220, 225, 230);
        doc.roundedRect(barX, y, rubBarW, 5, 1, 1, "F");
        doc.setFillColor(...(colors[i % colors.length]));
        const barW2 = Math.min((r.pct / 120) * rubBarW, rubBarW);
        doc.roundedRect(barX, y, Math.max(barW2, 2), 5, 1, 1, "F");
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(6.5);
        doc.text(r.name.substring(0, 22), margin + 2, y + 4);
        doc.text(`${r.pct}%`, barX + rubBarW + 2, y + 4);
      });
      startY += rubRows.length * 7 + 4;

      autoTable(doc, {
        startY,
        head: [["Rubrica", "Alocado", "Executado", "Saldo", "% Exec", "Status"]],
        body: rubRows.map(r => [
          r.name, formatCurrency(r.alloc), formatCurrency(r.exec), formatCurrency(r.saldo),
          `${r.pct}%`, r.pct > 100 ? "ESTOURADA" : r.pct >= 80 ? "ATENÇÃO" : "OK",
        ]),
        headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2 },
        bodyStyles: { fontSize: 7, textColor: [40, 40, 40], cellPadding: 2 },
        alternateRowStyles: { fillColor: lightBg },
        styles: { lineWidth: 0.1, lineColor: [200, 210, 220] },
        margin: { left: margin, right: margin },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 5) {
            const txt = data.cell.text[0];
            if (txt === "ESTOURADA") data.cell.styles.textColor = danger;
            else if (txt === "ATENÇÃO") data.cell.styles.textColor = [200, 150, 0];
            else data.cell.styles.textColor = success;
          }
          if (data.section === "body" && data.column.index === 3) {
            const val = parseFloat(data.cell.text[0].replace(/[R$\s.k]/g, "").replace(",", "."));
            if (val < 0) data.cell.styles.textColor = danger;
          }
        },
      });

      const rubTableY = (doc as any).lastAutoTable?.finalY || startY + 40;
      if (rubTableY < pageH - 30) {
        doc.setFillColor(...lightBg);
        doc.roundedRect(margin, rubTableY + 2, contentW, 10, 2, 2, "F");
        doc.setTextColor(...primary);
        doc.setFontSize(8);
        doc.text(`TOTAL: Alocado ${formatCurrency(totalAlloc)} | Executado ${formatCurrency(totalExec)} | Saldo ${formatCurrency(totalSaldo)} | Execução ${avgPct}%`, margin + 4, rubTableY + 8);
      }
    }
    addFooter();
    } // end rubricas

    // ═══ PAGE: MOVIMENTAÇÃO DE LEITOS ═══
    if (sections.leitos) {
    let startY = addHeader("Relatório de Lançamentos — Movimentação de Leitos");

    const year = Number(filterYear);
    const month = filterMonth === "todos" ? undefined : Number(filterMonth);
    const startDate = month !== undefined ? `${year}-${String(month + 1).padStart(2, "0")}-01` : `${year}-01-01`;
    const endDate = month !== undefined
      ? `${year}-${String(month + 1).padStart(2, "0")}-${getDaysInMonth(new Date(year, month))}`
      : `${year}-12-31`;

    const { data: bedMovData } = await supabase.from("bed_movements").select("*")
      .eq("facility_unit", selectedUnit)
      .gte("movement_date", startDate)
      .lte("movement_date", endDate)
      .order("movement_date", { ascending: true });

    const bedMovements = (bedMovData || []) as any[];
    const totalBedsForUnit = bedData.reduce((s, b) => s + b.quantity, 0);
    const totalInternacaoForUnit = bedData.filter(b => b.category === "internacao").reduce((s, b) => s + b.quantity, 0);
    const totalComplementarForUnit = bedData.filter(b => b.category === "complementar").reduce((s, b) => s + b.quantity, 0);

    // Aggregate by date
    const byDate = new Map<string, { occupied: number; admissions: number; discharges: number; deaths: number; transfers: number }>();
    bedMovements.forEach((m: any) => {
      const existing = byDate.get(m.movement_date) || { occupied: 0, admissions: 0, discharges: 0, deaths: 0, transfers: 0 };
      existing.occupied += m.occupied; existing.admissions += m.admissions;
      existing.discharges += m.discharges; existing.deaths += m.deaths; existing.transfers += m.transfers;
      byDate.set(m.movement_date, existing);
    });

    const dateEntries = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const totalOcc = dateEntries.length > 0 ? dateEntries.reduce((s, [, d]) => s + d.occupied, 0) / dateEntries.length : 0;
    const totalAdm = dateEntries.reduce((s, [, d]) => s + d.admissions, 0);
    const totalDis = dateEntries.reduce((s, [, d]) => s + d.discharges, 0);
    const totalDea = dateEntries.reduce((s, [, d]) => s + d.deaths, 0);
    const totalTrans = dateEntries.reduce((s, [, d]) => s + d.transfers, 0);
    const avgOccRate = totalBedsForUnit > 0 ? ((totalOcc / totalBedsForUnit) * 100).toFixed(1) : "0";
    const giro = totalInternacaoForUnit > 0 ? ((totalDis + totalDea) / totalInternacaoForUnit).toFixed(2) : "0";
    const maxOcc = dateEntries.length > 0 ? Math.max(...dateEntries.map(([, d]) => d.occupied)) : 0;
    const minOcc = dateEntries.length > 0 ? Math.min(...dateEntries.map(([, d]) => d.occupied)) : 0;

    startY = drawKpiBoxes([
      { label: "Ocupação Média", value: `${avgOccRate}%`, color: Number(avgOccRate) >= 85 ? danger : Number(avgOccRate) >= 70 ? warning : success },
      { label: "Giro de Leitos", value: giro },
      { label: "Total Internações", value: String(totalAdm) },
      { label: "Total Saídas", value: String(totalDis + totalDea) },
    ], startY);

    startY = drawKpiBoxes([
      { label: "Leitos Internação", value: String(totalInternacaoForUnit) },
      { label: "Leitos Complementar", value: String(totalComplementarForUnit) },
      { label: "Máx. Ocupados/Dia", value: String(maxOcc) },
      { label: "Mín. Ocupados/Dia", value: String(minOcc) },
    ], startY);

    startY = drawKpiBoxes([
      { label: "Transferências", value: String(totalTrans) },
      { label: "Óbitos", value: String(totalDea), color: totalDea > 0 ? danger : success },
      { label: "Dias Registrados", value: String(dateEntries.length) },
      { label: "Total Leitos", value: String(totalBedsForUnit) },
    ], startY);

    // ── Separate tables by category: Internação and Complementar ──
    const internacaoBeds = bedData.filter(b => b.category === "internacao");
    const complementarBeds = bedData.filter(b => b.category === "complementar");

    const buildSpecialtyTable = (categoryBeds: typeof bedData, categoryLabel: string, movements: any[]) => {
      if (categoryBeds.length === 0) return;
      startY = drawSectionTitle(`${categoryLabel} — Ocupação por Clínica`, startY);

      const specRows = categoryBeds.map(bed => {
        const specMovements = movements.filter((m: any) => m.category === bed.category && m.specialty === bed.specialty);
        const avgOcc = specMovements.length > 0 ? specMovements.reduce((s: number, m: any) => s + m.occupied, 0) / specMovements.length : 0;
        const specAdm = specMovements.reduce((s: number, m: any) => s + m.admissions, 0);
        const specDis = specMovements.reduce((s: number, m: any) => s + m.discharges, 0);
        const specDea = specMovements.reduce((s: number, m: any) => s + m.deaths, 0);
        const specTrans = specMovements.reduce((s: number, m: any) => s + m.transfers, 0);
        const occRate = bed.quantity > 0 ? ((avgOcc / bed.quantity) * 100).toFixed(1) : "0.0";
        return {
          specialty: bed.specialty, qty: bed.quantity, avgOcc: avgOcc.toFixed(0),
          admissions: specAdm, discharges: specDis, deaths: specDea, transfers: specTrans, occRate,
        };
      });

      // Category total
      const catTotalBeds = categoryBeds.reduce((s, b) => s + b.quantity, 0);
      const catTotalOcc = specRows.reduce((s, r) => s + Number(r.avgOcc), 0);
      const catOccRate = catTotalBeds > 0 ? ((catTotalOcc / catTotalBeds) * 100).toFixed(1) : "0.0";

      autoTable(doc, {
        startY,
        head: [["Clínica", "Leitos", "Ocup. Média", "Intern.", "Altas", "Óbitos", "Transf.", "Taxa Ocup."]],
        body: [
          ...specRows.map(r => [
            r.specialty, String(r.qty), r.avgOcc, String(r.admissions), String(r.discharges), String(r.deaths), String(r.transfers), `${r.occRate}%`,
          ]),
          // Total row
          [`TOTAL ${categoryLabel.toUpperCase()}`, String(catTotalBeds), String(catTotalOcc), 
           String(specRows.reduce((s, r) => s + r.admissions, 0)),
           String(specRows.reduce((s, r) => s + r.discharges, 0)),
           String(specRows.reduce((s, r) => s + r.deaths, 0)),
           String(specRows.reduce((s, r) => s + r.transfers, 0)),
           `${catOccRate}%`],
        ],
        headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2 },
        bodyStyles: { fontSize: 7, textColor: [40, 40, 40], cellPadding: 2 },
        alternateRowStyles: { fillColor: lightBg },
        styles: { lineWidth: 0.1, lineColor: [200, 210, 220] },
        margin: { left: margin, right: margin },
        didParseCell: (data: any) => {
          // Bold last row (total)
          if (data.section === "body" && data.row.index === specRows.length) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [220, 228, 240];
          }
          // Color the occupancy rate column
          if (data.section === "body" && data.column.index === 7) {
            const val = parseFloat(data.cell.text[0]);
            if (val >= 80) data.cell.styles.textColor = danger;
            else if (val >= 50) data.cell.styles.textColor = [200, 150, 0];
            else data.cell.styles.textColor = success;
          }
        },
      });
      startY = (doc as any).lastAutoTable?.finalY + 4 || startY + 30;
    };

    buildSpecialtyTable(internacaoBeds, "Internação", bedMovements);
    buildSpecialtyTable(complementarBeds, "Complementar (PS/Urgência)", bedMovements);

    // Occupancy trend chart
    if (dateEntries.length > 0) {
      // Check if we need a new page
      if (startY > pageH - 80) {
        addFooter();
        startY = addHeader("Relatório de Lançamentos — Movimentação de Leitos (cont.)");
      }

      const chartH = 35;
      startY = drawSectionTitle("Tendência de Ocupação (%)", startY);

      const chartStartX = margin + 10;
      const chartW = contentW - 14;

      doc.setDrawColor(210, 215, 220);
      for (let g = 0; g <= 4; g++) {
        const gy = startY + (chartH / 4) * g;
        doc.line(chartStartX, gy, chartStartX + chartW, gy);
        doc.setTextColor(160, 160, 160);
        doc.setFontSize(5);
        doc.text(`${100 - g * 25}%`, chartStartX - 1, gy + 1, { align: "right" });
      }

      if (dateEntries.length > 1) {
        const step = chartW / (dateEntries.length - 1);
        doc.setDrawColor(...primary);
        doc.setLineWidth(0.6);
        for (let i = 1; i < dateEntries.length; i++) {
          const prevRate = totalBedsForUnit > 0 ? (dateEntries[i - 1][1].occupied / totalBedsForUnit) * 100 : 0;
          const currRate = totalBedsForUnit > 0 ? (dateEntries[i][1].occupied / totalBedsForUnit) * 100 : 0;
          const x1 = chartStartX + (i - 1) * step;
          const y1 = startY + chartH - (prevRate / 100) * chartH;
          const x2 = chartStartX + i * step;
          const y2 = startY + chartH - (currRate / 100) * chartH;
          doc.line(x1, y1, x2, y2);
          doc.setFillColor(...primary);
          doc.circle(x2, y2, 0.8, "F");
          if (i === 1) doc.circle(x1, y1, 0.8, "F");
        }
        doc.setLineWidth(0.2);
      }

      doc.setTextColor(120, 120, 120);
      doc.setFontSize(5);
      doc.text(format(new Date(dateEntries[0][0] + "T00:00:00"), "dd/MM"), chartStartX, startY + chartH + 5);
      if (dateEntries.length > 2) {
        const mid = Math.floor(dateEntries.length / 2);
        doc.text(format(new Date(dateEntries[mid][0] + "T00:00:00"), "dd/MM"), chartStartX + chartW / 2, startY + chartH + 5, { align: "center" });
      }
      doc.text(format(new Date(dateEntries[dateEntries.length - 1][0] + "T00:00:00"), "dd/MM"), chartStartX + chartW, startY + chartH + 5, { align: "right" });

      startY += chartH + 10;
    }

    // Daily movements table
    if (dateEntries.length > 0) {
      if (startY > pageH - 60) {
        addFooter();
        startY = addHeader("Relatório de Lançamentos — Movimentação de Leitos (cont.)");
      }

      startY = drawSectionTitle("Histórico Diário", startY);

      autoTable(doc, {
        startY,
        head: [["Data", "Ocupados", "Intern.", "Altas", "Óbitos", "Transf.", "Saldo", "Ocupação"]],
        body: dateEntries.map(([date, d]) => {
          const saldo = d.admissions - (d.discharges + d.deaths + d.transfers);
          return [
            format(new Date(date + "T00:00:00"), "dd/MM/yyyy"),
            String(d.occupied), String(d.admissions), String(d.discharges), String(d.deaths), String(d.transfers),
            String(saldo), totalBedsForUnit > 0 ? `${((d.occupied / totalBedsForUnit) * 100).toFixed(1)}%` : "0%",
          ];
        }),
        headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2 },
        bodyStyles: { fontSize: 7, textColor: [40, 40, 40], cellPadding: 2 },
        alternateRowStyles: { fillColor: lightBg },
        styles: { lineWidth: 0.1, lineColor: [200, 210, 220] },
        margin: { left: margin, right: margin },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 6) {
            const val = parseInt(data.cell.text[0]);
            if (val < 0) data.cell.styles.textColor = danger;
            else if (val > 0) data.cell.styles.textColor = success;
          }
        },
      });

      const movTableY = (doc as any).lastAutoTable?.finalY || startY + 20;
      if (movTableY < pageH - 30) {
        doc.setFillColor(...lightBg);
        doc.roundedRect(margin, movTableY + 2, contentW, 10, 2, 2, "F");
        doc.setTextColor(...primary);
        doc.setFontSize(7);
        doc.text(`TOTAIS: Internações ${totalAdm} | Altas ${totalDis} | Óbitos ${totalDea} | Transferências ${totalTrans} | Ocupação Média ${avgOccRate}% | Giro ${giro}`, margin + 4, movTableY + 8);
      }
    } else {
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(9);
      doc.text("Nenhuma movimentação registrada no período.", margin, startY + 8);
    }
    addFooter();
    } // end leitos

    // ═══ PAGE: MAPA TÉRMICO ═══
    if (sections.mapaTermico) {
      let startY = addHeader("Relatório de Lançamentos — Mapa Térmico Diário");

      const hmGoals = goals.filter(g => !selectedUnit || g.facility_unit === selectedUnit);
      const hmYear = Number(filterYear);
      const hmMonth = filterMonth === "todos" ? new Date().getMonth() : Number(filterMonth);
      const hmDaysInMo = getDaysInMonth(new Date(hmYear, hmMonth));
      const hmLabel = FILTER_MONTHS.find(m => m.value === String(hmMonth))?.label || "";

      // Build day map using parse (period is dd/MM/yyyy)
      const hmDayMap: Record<string, Record<number, number>> = {};
      hmGoals.forEach(g => {
        hmDayMap[g.id] = {};
        const gEntries = existingEntries[g.id] || [];
        gEntries.forEach(e => {
          try {
            const d = parse(e.period, "dd/MM/yyyy", new Date());
            if (d.getFullYear() === hmYear && d.getMonth() === hmMonth) {
              hmDayMap[g.id][d.getDate()] = (hmDayMap[g.id][d.getDate()] || 0) + e.value;
            }
          } catch {}
        });
      });

      // Per-row stats
      const hmRowStats: Record<string, { min: number; max: number }> = {};
      hmGoals.forEach(g => {
        const vals = Object.values(hmDayMap[g.id] || {});
        if (vals.length > 0) {
          hmRowStats[g.id] = { min: Math.min(...vals), max: Math.max(...vals) };
        }
      });

      // KPIs
      let hmGoalsWithEntries = 0;
      let hmSumPct = 0;
      const hmDaysSet = new Set<number>();
      hmGoals.forEach(g => {
        const dayEntries = hmDayMap[g.id] || {};
        const count = Object.keys(dayEntries).length;
        if (count > 0) {
          hmGoalsWithEntries++;
          const total = Object.values(dayEntries).reduce((s, v) => s + v, 0);
          hmSumPct += g.target > 0 ? (total / g.target) * 100 : 0;
        }
        Object.keys(dayEntries).forEach(d => hmDaysSet.add(Number(d)));
      });
      const hmAvgPct = hmGoalsWithEntries > 0 ? Math.round(hmSumPct / hmGoalsWithEntries) : 0;
      const hmCoverage = Math.round((hmDaysSet.size / hmDaysInMo) * 100);

      startY = drawKpiBoxes([
        { label: "Metas com Lançamento", value: `${hmGoalsWithEntries}/${hmGoals.length}` },
        { label: "Atingimento Médio", value: `${hmAvgPct}%`, color: hmAvgPct >= 100 ? success : hmAvgPct >= 70 ? warning : danger },
        { label: "Dias com Lançamento", value: `${hmDaysSet.size}/${hmDaysInMo}` },
        { label: "Cobertura do Mês", value: `${hmCoverage}%`, color: hmCoverage >= 80 ? success : hmCoverage >= 50 ? warning : danger },
      ], startY);

      startY = drawSectionTitle(`Mapa Térmico — ${hmLabel} ${hmYear}`, startY);

      // Draw heatmap grid
      const cellW = Math.min(5, (contentW - 50) / hmDaysInMo);
      const nameColW = 38;
      const gridStartX = margin + nameColW;

      // Header row: day numbers
      doc.setFontSize(4.5);
      doc.setTextColor(120, 120, 120);
      for (let d = 1; d <= hmDaysInMo; d++) {
        doc.text(String(d), gridStartX + (d - 1) * cellW + cellW / 2, startY, { align: "center" });
      }
      doc.text("Total", gridStartX + hmDaysInMo * cellW + 2, startY);
      doc.text("%", gridStartX + hmDaysInMo * cellW + 14, startY);
      startY += 3;

      const getHmColor = (goalId: string, value: number, lowerIsBetter: boolean): [number, number, number] => {
        const stats = hmRowStats[goalId];
        if (!stats || stats.min === stats.max) return [46, 160, 67];
        const { min, max } = stats;
        const norm = lowerIsBetter ? (max - value) / (max - min) : (value - min) / (max - min);
        if (norm >= 0.75) return [46, 160, 67];
        if (norm >= 0.50) return [241, 196, 15];
        if (norm >= 0.25) return [230, 126, 34];
        return [231, 76, 60];
      };

      const rowH = 5.5;
      hmGoals.forEach(g => {
        if (startY + rowH > pageH - 18) {
          addFooter();
          startY = addHeader("Relatório — Mapa Térmico (cont.)");
        }

        const lowerIsBetter = g.name.toLowerCase().includes("tempo") ||
          g.name.toLowerCase().includes("infecção") ||
          g.name.toLowerCase().includes("retorno") ||
          g.name.toLowerCase().includes("mortalidade") ||
          g.name.toLowerCase().includes("óbito");

        doc.setFontSize(5);
        doc.setTextColor(40, 40, 40);
        doc.text(g.name.substring(0, 20), margin, startY + rowH - 1.5);

        const dayEntries = hmDayMap[g.id] || {};
        let totalVal = 0;
        for (let d = 1; d <= hmDaysInMo; d++) {
          const x = gridStartX + (d - 1) * cellW;
          const val = dayEntries[d];
          if (val !== undefined) {
            totalVal += val;
            const color = getHmColor(g.id, val, lowerIsBetter);
            doc.setFillColor(...color);
            doc.roundedRect(x + 0.3, startY, cellW - 0.6, rowH - 0.5, 0.5, 0.5, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(4);
            doc.text(String(val), x + cellW / 2, startY + rowH - 2, { align: "center" });
          } else {
            doc.setFillColor(230, 233, 237);
            doc.roundedRect(x + 0.3, startY, cellW - 0.6, rowH - 0.5, 0.5, 0.5, "F");
          }
        }

        const pct = g.target > 0 ? Math.round((totalVal / g.target) * 100) : 0;
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(5);
        doc.text(String(totalVal), gridStartX + hmDaysInMo * cellW + 2, startY + rowH - 1.5);
        doc.setTextColor(...(pct >= 100 ? success : pct >= 70 ? warning : danger));
        doc.text(`${pct}%`, gridStartX + hmDaysInMo * cellW + 14, startY + rowH - 1.5);

        startY += rowH + 1;
      });

      // Legend
      startY += 3;
      if (startY < pageH - 25) {
        const legendItems: { label: string; color: [number, number, number] }[] = [
          { label: "Melhor da meta", color: [46, 160, 67] },
          { label: "Acima da mediana", color: [241, 196, 15] },
          { label: "Abaixo da mediana", color: [230, 126, 34] },
          { label: "Pior da meta", color: [231, 76, 60] },
          { label: "Sem lançamento", color: [230, 233, 237] },
        ];
        let lx = margin;
        doc.setFontSize(5);
        legendItems.forEach(item => {
          doc.setFillColor(...item.color);
          doc.roundedRect(lx, startY, 3, 3, 0.5, 0.5, "F");
          doc.setTextColor(100, 100, 100);
          doc.text(item.label, lx + 4, startY + 2.5);
          lx += 30;
        });
      }
      addFooter();
    } // end mapa termico

    doc.save(`lancamentos_${format(now, "yyyyMMdd_HHmm")}.pdf`);
    toast.success("PDF gerado com sucesso!");
    } finally {
      setPdfGenerating(false);
    }
  };

  useEffect(() => {
    if (!profile || !user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const admin = data?.some((r: any) => r.role === "admin" || r.role === "gestor");
      setIsAdmin(!!admin);
      setSelectedUnit(profile.facility_unit);
    });
  }, [profile, user]);

  useEffect(() => {
    if (!selectedUnit) return;
    loadGoals(selectedUnit);
    // Load bed data for the selected unit
    supabase.from("beds").select("category, specialty, quantity").eq("facility_unit", selectedUnit)
      .then(({ data }) => setBedData((data as any[]) || []));
  }, [selectedUnit]);

  const loadGoals = async (unit: string) => {
    setLoading(true);
    const { data, error } = await supabase.from("goals").select("*").eq("facility_unit", unit as any);
    if (error) { toast.error("Erro ao carregar metas"); setLoading(false); return; }
    setGoals((data as Goal[]) || []);
    if (data && user) {
      // Admins see all entries, regular users see only their own
      let query = supabase.from("goal_entries").select("*");
      if (!isAdmin) query = query.eq("user_id", user.id);
      const { data: entriesData } = await query;
      const grouped: Record<string, { value: number; period: string }[]> = {};
      (entriesData || []).forEach((e: any) => {
        if (!grouped[e.goal_id]) grouped[e.goal_id] = [];
        grouped[e.goal_id].push({ value: e.value, period: e.period });
      });
      setExistingEntries(grouped);
    }
    setLoading(false);
  };

  const handleSubmit = async (goalId: string) => {
    if (!user) return;
    const entry = entries[goalId];
    if (!entry?.value || !entry?.period) { toast.error("Preencha o valor e o período"); return; }
    setSubmitting(goalId);
    const { error } = await supabase.from("goal_entries").insert({
      goal_id: goalId, user_id: user.id, value: parseFloat(entry.value), period: entry.period, notes: entry.notes || null,
    });
    if (error) { toast.error("Erro ao salvar lançamento"); }
    else { toast.success("Lançamento salvo com sucesso"); setEntries(prev => ({ ...prev, [goalId]: { value: "", period: "", notes: "" } })); loadGoals(selectedUnit); }
    setSubmitting(null);
  };

  const updateEntry = (goalId: string, field: keyof EntryForm, value: string) => {
    setEntries(prev => ({ ...prev, [goalId]: { ...prev[goalId], [field]: value } }));
  };

  /* ── Rubrica state ── */
  const { contracts: realContracts } = useContracts();
  const [selectedContract, setSelectedContract] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("Janeiro");
  const [rubricaEntries, setRubricaEntries] = useState<Record<string, EntryForm>>({});
  const [rubricaSubmitting, setRubricaSubmitting] = useState<string | null>(null);
  const [savedRubricaEntries, setSavedRubricaEntries] = useState<any[]>([]);

  // Set default contract when contracts load
  useEffect(() => {
    if (realContracts.length > 0 && !selectedContract) {
      setSelectedContract(realContracts[0].id);
    }
  }, [realContracts, selectedContract]);

  // Load saved rubrica entries
  useEffect(() => {
    if (!selectedContract) return;
    supabase.from("rubrica_entries").select("*").eq("contract_id", selectedContract)
      .then(({ data }) => setSavedRubricaEntries(data || []));
  }, [selectedContract]);

  const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const handleRubricaSubmit = async (key: string, rubName: string, contractId: string, contractUnit: string) => {
    const entry = rubricaEntries[key];
    if (!entry?.value || !entry?.period) { toast.error("Preencha o valor e a data"); return; }
    if (!user) return;
    setRubricaSubmitting(key);
    const { error } = await supabase.from("rubrica_entries").insert({
      contract_id: contractId,
      rubrica_name: rubName,
      value_executed: parseFloat(entry.value),
      period: entry.period,
      facility_unit: contractUnit,
      notes: entry.notes || null,
      user_id: user.id,
    });
    if (error) { toast.error("Erro ao salvar lançamento de rubrica"); console.error(error); }
    else {
      toast.success(`Lançamento de ${rubName} salvo`);
      setRubricaEntries(prev => ({ ...prev, [key]: { value: "", period: "", notes: "" } }));
      // Reload entries
      const { data } = await supabase.from("rubrica_entries").select("*").eq("contract_id", contractId);
      setSavedRubricaEntries(data || []);
    }
    setRubricaSubmitting(null);
  };

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          Voltar
        </Button>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Lançamentos</h1>
            <p className="text-sm text-muted-foreground">Lançamento de metas e rubricas</p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            {/* Unidade — Metas e Leitos */}
            {(activeTab === "lancar-metas" || activeTab === "lancar-leitos" || activeTab === "mapa-termico") && (
              isAdmin ? (
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Unidade</label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2">
                  <p className="text-xs text-muted-foreground">Sua unidade</p>
                  <p className="font-display font-semibold text-foreground text-sm">{profile?.facility_unit || "Carregando..."}</p>
                </div>
              )
            )}
            {/* Contrato — apenas Rubricas */}
            {activeTab === "lancamento-rubricas" && (
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Contrato</label>
                <Select value={selectedContract} onValueChange={setSelectedContract}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{realContracts.map(c => <SelectItem key={c.id} value={c.id}>{c.unit}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {/* Ano — todas as abas */}
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Ano</label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>{FILTER_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* Mês — todas as abas (filtro único) */}
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Mês</label>
              <Select value={filterMonth} onValueChange={(v) => { setFilterMonth(v); if (activeTab === "lancamento-rubricas") { const m = FILTER_MONTHS.find(fm => fm.value === v); if (m && m.value !== "todos") setSelectedMonth(m.label); } }}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{FILTER_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* Tipo — apenas Metas e Mapa Térmico */}
            {(activeTab === "lancar-metas" || activeTab === "mapa-termico") && (
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Tipo</label>
                <Select value={filterType} onValueChange={(v) => { setFilterType(v); setFilterGoal("todos"); }}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="QNT">Quantitativa</SelectItem>
                    <SelectItem value="QLT">Qualitativa</SelectItem>
                    <SelectItem value="DOC">Documental</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Meta específica — apenas Metas */}
            {activeTab === "lancar-metas" && (
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Meta</label>
                <Select value={filterGoal} onValueChange={setFilterGoal}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {goals
                      .filter(g => filterType === "todos" || g.type === filterType)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="outline" size="sm" className="h-9" onClick={() => setPdfModalOpen(true)}>
              Gerar PDF
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="lancar-metas">Lançamento de Metas</TabsTrigger>
            {isAdmin && <TabsTrigger value="lancamento-rubricas">Lançamento de Rubricas</TabsTrigger>}
            <TabsTrigger value="lancar-leitos">Movimentação de Leitos</TabsTrigger>
            {isAdmin && <TabsTrigger value="mapa-termico">Mapa Térmico Diário</TabsTrigger>}
          </TabsList>

          {/* ── TAB: Lançamento de Metas ── */}
          <TabsContent value="lancar-metas">
            {loading ? (
              <p className="text-muted-foreground text-center py-12">Carregando metas...</p>
            ) : goals.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhuma meta cadastrada para sua unidade.</p>
                <p className="text-sm text-muted-foreground mt-1">Peça ao administrador para cadastrar as metas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {goals
                  .filter(g => filterType === "todos" || g.type === filterType)
                  .filter(g => filterGoal === "todos" || g.id === filterGoal)
                  .map((goal, i) => {
                  const entry = entries[goal.id] || { value: "", period: "", notes: "" };
                  const existing = filterEntriesByDate(existingEntries[goal.id] || []);
                  return (
                    <motion.div key={goal.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="kpi-card flex flex-col">
                      {/* Gauge + header */}
                      {(() => {
                        const currentVal = existing.reduce((sum, e) => sum + e.value, 0);
                        const attainment = goal.type === "DOC" ? (currentVal >= goal.target ? 100 : 0) : goal.target > 0 ? Math.min(100, Math.round((currentVal / goal.target) * 100)) : 0;
                        const remaining = Math.max(0, goal.target - currentVal);
                        const endDate = goal.end_date ? new Date(goal.end_date) : null;
                        const daysRemaining = endDate ? Math.max(0, Math.ceil((endDate.getTime() - new Date().getTime()) / 86400000)) : 0;
                        const dailyGoal = daysRemaining > 0 ? remaining / daysRemaining : remaining;
                        return (
                          <>
                            <div className="flex items-start justify-between mb-1">
                              <div>
                                <h3 className="font-display font-semibold text-foreground text-sm">{goal.name}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Meta: {goal.target} {goal.unit} — Peso: {(goal.weight * 100).toFixed(0)}%</p>
                              </div>
                              <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded">{goal.type}</span>
                            </div>
                            <div className="flex justify-center">
                              <GoalGauge percent={attainment} size={100} />
                            </div>
                            <div className="bg-secondary/50 rounded-lg p-2 text-center mb-2">
                              <p className="text-[10px] text-muted-foreground">
                                Faltam <span className="font-semibold text-foreground">{remaining.toFixed(1)} {goal.unit}</span>
                                {endDate && daysRemaining > 0 ? (
                                  <> • Meta diária: <span className="font-semibold text-foreground">{dailyGoal.toFixed(2)} {goal.unit}/dia</span> ({daysRemaining}d)</>
                                ) : endDate && daysRemaining === 0 ? (
                                  <> • <span className="text-destructive font-medium">Prazo encerrado</span></>
                                ) : null}
                              </p>
                            </div>
                            {isBedRelatedGoal(goal.name) && totalBedsByCategory.total > 0 && (
                              <div className="bg-primary/5 border border-primary/10 rounded-lg p-2 mb-2">
                                <p className="text-[10px] font-semibold text-foreground mb-1">Leitos vinculados — {selectedUnit}</p>
                                <div className="flex gap-3 text-[10px] text-muted-foreground">
                                  <span>Internação: <span className="font-semibold text-foreground">{totalBedsByCategory.internacao}</span></span>
                                  <span>Complementar: <span className="font-semibold text-foreground">{totalBedsByCategory.complementar}</span></span>
                                  <span>Total: <span className="font-semibold text-foreground">{totalBedsByCategory.total}</span></span>
                                </div>
                                {entry.value && (
                                  <div className="mt-1 pt-1 border-t border-primary/10 text-[10px] text-muted-foreground">
                                    {goal.name.toLowerCase().includes("rotatividade") ? (
                                      <span>Rotatividade: <span className="font-semibold text-foreground">{(parseFloat(entry.value) / totalBedsByCategory.internacao).toFixed(2)}</span> pacientes/leito</span>
                                    ) : (
                                      <span>Taxa de ocupação: <span className="font-semibold text-foreground">{((parseFloat(entry.value) / totalBedsByCategory.internacao) * 100).toFixed(1)}%</span> ({parseFloat(entry.value)} de {totalBedsByCategory.internacao} leitos)</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {existing.length > 0 && (
                        <div className="mb-3 p-2 bg-secondary/50 rounded">
                          <p className="text-[10px] text-muted-foreground mb-1">Lançamentos anteriores:</p>
                          <div className="flex flex-wrap gap-1">
                            {existing.map((e, idx) => (
                              <span key={idx} className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border">{e.period}: {e.value}{goal.unit}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="space-y-2 mt-auto">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Valor realizado</label>
                            <Input type="number" step="0.01" placeholder={`Ex: ${goal.target}`} value={entry.value} onChange={e => updateEntry(goal.id, "value", e.target.value)} className="h-8 text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Data do lançamento</label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full h-8 text-sm justify-start text-left font-normal", !entry.period && "text-muted-foreground")}>
                                  <CalendarIcon className="mr-2 h-3 w-3" />
                                  {entry.period || "Selecione o dia"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={entry.period ? new Date(entry.period.split("/").reverse().join("-")) : undefined} onSelect={date => { if (date) updateEntry(goal.id, "period", format(date, "dd/MM/yyyy")); }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        <Textarea placeholder="Observações (opcional)" value={entry.notes} onChange={e => updateEntry(goal.id, "notes", e.target.value)} className="text-sm min-h-[40px]" />
                        <Button size="sm" className="w-full" disabled={submitting === goal.id} onClick={() => handleSubmit(goal.id)}>
                          {submitting === goal.id ? "Salvando..." : "Lançar"}
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── TAB: Lançamento de Rubricas ── */}
          <TabsContent value="lancamento-rubricas">

            {(() => {
              const contract = realContracts.find(c => c.id === selectedContract);
              if (!contract) return <p className="text-muted-foreground text-center py-12">Selecione um contrato</p>;

              const rubNames = (contract.rubricas || []).filter(r => r.percent > 0).map(r => r.name);
              if (rubNames.length === 0) return (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhuma rubrica cadastrada para este contrato.</p>
                  <p className="text-sm text-muted-foreground mt-1">Cadastre rubricas no módulo de Contratos.</p>
                </div>
              );

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {rubNames.map((rubName, i) => {
                    const rubrica = (contract.rubricas || []).find(r => r.name === rubName);
                    const allocated = contract.value * ((rubrica?.percent || 0) / 100);
                    const executed = savedRubricaEntries.filter(e => e.rubrica_name === rubName).reduce((s: number, e: any) => s + Number(e.value_executed), 0);
                    const pctExec = allocated > 0 ? Math.round((executed / allocated) * 100) : 0;
                    const estourada = executed > allocated;
                    const rubEntryKey = `${selectedContract}-${rubName}-${selectedMonth}`;
                    const rubEntry = rubricaEntries[rubEntryKey] || { value: "", period: "", notes: "" };
                    const previousEntries = savedRubricaEntries.filter(e => e.rubrica_name === rubName);

                    return (
                      <motion.div key={rubName} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="kpi-card">
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <h3 className="font-display font-semibold text-foreground text-sm">{rubName}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Alocado: {formatCurrency(allocated)} — {rubrica?.percent || 0}% do contrato
                            </p>
                          </div>
                          <span className={`status-badge text-[10px] ${estourada ? "status-critical" : pctExec >= 70 ? "status-success" : "status-warning"}`}>
                            {pctExec}%
                          </span>
                        </div>

                        <div className="flex justify-center">
                          <GoalGauge percent={pctExec} size={100} />
                        </div>

                        <div className="bg-secondary/50 rounded-lg p-2 text-center mb-2">
                          <p className="text-[10px] text-muted-foreground">
                            Executado: <span className={`font-semibold ${estourada ? "text-destructive" : "text-foreground"}`}>{formatCurrency(executed)}</span>
                            {" • "}Saldo: <span className={`font-semibold ${estourada ? "text-destructive" : "text-foreground"}`}>{formatCurrency(allocated - executed)}</span>
                          </p>
                        </div>

                        {previousEntries.length > 0 && (
                          <div className="mb-3 p-2 bg-secondary/50 rounded">
                            <p className="text-[10px] text-muted-foreground mb-1">Lançamentos anteriores:</p>
                            <div className="flex flex-wrap gap-1">
                              {previousEntries.map((e: any, idx: number) => (
                                <span key={idx} className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border">{e.period}: {formatCurrency(Number(e.value_executed))}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Valor executado</label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="R$ 0,00"
                                value={rubEntry.value}
                                onChange={e => setRubricaEntries(prev => ({ ...prev, [rubEntryKey]: { ...prev[rubEntryKey], value: e.target.value } }))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Data do lançamento</label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className={cn("w-full h-8 text-sm justify-start text-left font-normal", !rubEntry.period && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {rubEntry.period || "Selecione o dia"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar mode="single" selected={rubEntry.period ? new Date(rubEntry.period.split("/").reverse().join("-")) : undefined} onSelect={date => { if (date) setRubricaEntries(prev => ({ ...prev, [rubEntryKey]: { ...prev[rubEntryKey], period: format(date, "dd/MM/yyyy") } })); }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          <Textarea
                            placeholder="Observações (opcional)"
                            value={rubEntry.notes || ""}
                            onChange={e => setRubricaEntries(prev => ({ ...prev, [rubEntryKey]: { ...prev[rubEntryKey], notes: e.target.value } }))}
                            className="text-sm min-h-[40px]"
                          />
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={rubricaSubmitting === rubEntryKey}
                            onClick={() => handleRubricaSubmit(rubEntryKey, rubName, contract.id, contract.unit)}
                          >
                            {rubricaSubmitting === rubEntryKey ? "Salvando..." : "Lançar"}
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>

          {/* ── TAB: Movimentação de Leitos ── */}
          <TabsContent value="lancar-leitos">
            <BedMovementsTab selectedUnit={selectedUnit} onUnitChange={setSelectedUnit} isAdmin={isAdmin} filterYear={filterYear} filterMonth={filterMonth} />
          </TabsContent>

          {/* ── TAB: Mapa Térmico Diário ── */}
          <TabsContent value="mapa-termico">
            {(() => {
              const year = Number(filterYear);
              const month = filterMonth === "todos" ? currentMonth : Number(filterMonth);
              const daysInMonth = getDaysInMonth(new Date(year, month));
              const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
              const monthLabel = FILTER_MONTHS.find(m => m.value === String(month))?.label || "";

              // Build a map: goalId -> { day -> value }
              const heatmapGoals = goals.filter(g => !selectedUnit || g.facility_unit === selectedUnit);
              const goalDayMap: Record<string, Record<number, number>> = {};

              heatmapGoals.forEach(g => {
                goalDayMap[g.id] = {};
                const gEntries = existingEntries[g.id] || [];
                gEntries.forEach(e => {
                  try {
                    const d = parse(e.period, "dd/MM/yyyy", new Date());
                    if (d.getFullYear() === year && d.getMonth() === month) {
                      goalDayMap[g.id][d.getDate()] = e.value;
                    }
                  } catch {}
                });
              });

              // Collect all values for global mode ranking
              const allValues: number[] = [];
              if (heatmapCompare === "global") {
                heatmapGoals.forEach(g => {
                  const entries = goalDayMap[g.id] || {};
                  Object.values(entries).forEach(v => allValues.push(v));
                });
                allValues.sort((a, b) => a - b);
              }

              const getPercentileColor = (value: number) => {
                if (allValues.length === 0) return "bg-muted/30 text-muted-foreground/50";
                const rank = allValues.filter(v => v <= value).length;
                const pct = (rank / allValues.length) * 100;
                // Heat map: red (worst/lowest) → orange → yellow → green (best/highest)
                if (pct <= 25) return "bg-destructive/80 text-white";
                if (pct <= 50) return "bg-orange-400/80 text-white";
                if (pct <= 75) return "bg-amber-400/80 text-white";
                return "bg-emerald-500/80 text-white";
              };

              // Pre-compute per-row min/max for "meta" mode
              const rowStats: Record<string, { min: number; max: number; values: number[] }> = {};
              heatmapGoals.forEach(g => {
                const entries = goalDayMap[g.id] || {};
                const vals = Object.values(entries);
                if (vals.length > 0) {
                  rowStats[g.id] = { min: Math.min(...vals), max: Math.max(...vals), values: vals };
                }
              });

              const getCellColor = (goal: Goal, value: number | undefined) => {
                if (value === undefined) return "bg-muted/30 text-muted-foreground/50";

                const lowerIsBetter = goal.name.toLowerCase().includes("tempo") ||
                  goal.name.toLowerCase().includes("infecção") ||
                  goal.name.toLowerCase().includes("retorno") ||
                  goal.name.toLowerCase().includes("mortalidade") ||
                  goal.name.toLowerCase().includes("óbito");

                if (heatmapCompare === "meta") {
                  // Compare within the row: worst value = red, best = green
                  const stats = rowStats[goal.id];
                  if (!stats || stats.values.length <= 1) return "bg-emerald-500/80 text-white";
                  const { min, max } = stats;
                  if (min === max) return "bg-emerald-500/80 text-white";

                  // Normalize 0-1 where 0=worst, 1=best
                  let norm: number;
                  if (lowerIsBetter) {
                    // Lower is better: min=best(1), max=worst(0)
                    norm = (max - value) / (max - min);
                  } else {
                    // Higher is better: max=best(1), min=worst(0)
                    norm = (value - min) / (max - min);
                  }

                  if (norm >= 0.75) return "bg-emerald-500/80 text-white";
                  if (norm >= 0.50) return "bg-amber-400/80 text-white";
                  if (norm >= 0.25) return "bg-orange-400/80 text-white";
                  return "bg-destructive/80 text-white";
                }

                // Global mode: relative ranking across all values
                return getPercentileColor(value);
              };

              if (heatmapGoals.length === 0) {
                return <p className="text-muted-foreground text-center py-12">Nenhuma meta encontrada para esta unidade e período.</p>;
              }

              return (
                <div className="space-y-4">
                  <div className="kpi-card p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="font-display font-semibold text-foreground text-sm mb-1">Mapa Térmico — {monthLabel} {filterYear}</h3>
                        <p className="text-xs text-muted-foreground">Visualização diária do atingimento de cada meta. Células coloridas indicam lançamentos realizados.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground font-medium">Comparar:</span>
                        <Select value={heatmapCompare} onValueChange={(v: "global" | "meta") => setHeatmapCompare(v)}>
                          <SelectTrigger className="h-7 text-xs w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="global">Global (fixo)</SelectItem>
                            <SelectItem value="meta">Própria meta (alvo)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-3">
                      {heatmapCompare === "global" ? (
                        <>
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500/80" /><span className="text-[10px] text-muted-foreground">Top 25% (melhor)</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-400/80" /><span className="text-[10px] text-muted-foreground">50–75%</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-400/80" /><span className="text-[10px] text-muted-foreground">25–50%</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-destructive/80" /><span className="text-[10px] text-muted-foreground">Bottom 25% (pior)</span></div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500/80" /><span className="text-[10px] text-muted-foreground">Melhor da meta</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-400/80" /><span className="text-[10px] text-muted-foreground">Acima da mediana</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-400/80" /><span className="text-[10px] text-muted-foreground">Abaixo da mediana</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-destructive/80" /><span className="text-[10px] text-muted-foreground">Pior da meta</span></div>
                        </>
                      )}
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-muted/30 border border-border" /><span className="text-[10px] text-muted-foreground">Sem lançamento</span></div>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
                    <table className="w-full text-xs border-separate border-spacing-0.5">
                      <thead className="sticky top-0 z-20 bg-background">
                        <tr>
                          <th className="text-left font-semibold text-foreground p-1.5 min-w-[180px] sticky left-0 bg-background z-30">Meta</th>
                          <th className="text-center font-semibold text-muted-foreground p-1 min-w-[28px] bg-background">Alvo</th>
                          {days.map(d => (
                            <th key={d} className={cn(
                              "text-center font-medium p-1 min-w-[28px] bg-background",
                              d === new Date().getDate() && month === currentMonth && year === currentYear ? "text-primary font-bold" : "text-muted-foreground"
                            )}>{d}</th>
                          ))}
                          <th className="text-center font-semibold text-foreground p-1 min-w-[40px] bg-background">Total</th>
                          <th className="text-center font-semibold text-foreground p-1 min-w-[40px] bg-background">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatmapGoals.map((goal, gi) => {
                          const dayEntries = goalDayMap[goal.id] || {};
                          const totalValue = Object.values(dayEntries).reduce((s, v) => s + v, 0);
                          const totalPct = goal.target > 0 ? Math.min(999, Math.round((totalValue / goal.target) * 100)) : 0;
                          const entryCount = Object.keys(dayEntries).length;

                          return (
                            <motion.tr key={goal.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: gi * 0.02 }}
                              className="group hover:bg-muted/20">
                              <td className="p-1.5 sticky left-0 bg-background z-10">
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    totalPct >= 90 ? "bg-emerald-500" : totalPct >= 70 ? "bg-amber-400" : totalPct >= 50 ? "bg-orange-400" : "bg-destructive"
                                  }`} />
                                  <span className="font-medium text-foreground truncate max-w-[160px]" title={goal.name}>{goal.name}</span>
                                </div>
                                <span className={`status-badge text-[9px] mt-0.5 ${goal.type === "QNT" ? "bg-accent text-accent-foreground" : goal.type === "QLT" ? "status-success" : "status-warning"}`}>{goal.type}</span>
                              </td>
                              <td className="text-center p-1 text-muted-foreground font-medium">{goal.target} {goal.unit}</td>
                              {days.map(d => {
                                const val = dayEntries[d];
                                return (
                                  <td key={d} className="p-0.5">
                                    <div className={cn(
                                      "w-full h-7 rounded flex items-center justify-center text-[9px] font-medium transition-all",
                                      getCellColor(goal, val),
                                      val !== undefined && "shadow-sm"
                                    )} title={val !== undefined ? `Dia ${d}: ${val}${goal.unit} (${goal.target > 0 ? Math.round((val / goal.target) * 100) : 0}%)` : `Dia ${d}: sem lançamento`}>
                                      {val !== undefined ? val : "·"}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="text-center p-1 font-semibold text-foreground">{entryCount > 0 ? totalValue : "—"}</td>
                              <td className={cn("text-center p-1 font-bold", totalPct >= 90 ? "text-emerald-600" : totalPct >= 70 ? "text-amber-500" : "text-destructive")}>{entryCount > 0 ? `${totalPct}%` : "—"}</td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(() => {
                      const allEntryDays = new Set<number>();
                      let totalGoalsWithEntries = 0;
                      let sumPct = 0;
                      heatmapGoals.forEach(g => {
                        const dayEntries = goalDayMap[g.id] || {};
                        const count = Object.keys(dayEntries).length;
                        if (count > 0) {
                          totalGoalsWithEntries++;
                          const total = Object.values(dayEntries).reduce((s, v) => s + v, 0);
                          sumPct += g.target > 0 ? Math.min(100, (total / g.target) * 100) : 0;
                        }
                        Object.keys(dayEntries).forEach(d => allEntryDays.add(Number(d)));
                      });
                      const avgPct = totalGoalsWithEntries > 0 ? Math.round(sumPct / totalGoalsWithEntries) : 0;
                      const coverage = Math.round((allEntryDays.size / daysInMonth) * 100);

                      return (
                        <>
                          <div className="kpi-card p-3 text-center">
                            <p className="text-lg font-bold text-foreground">{totalGoalsWithEntries}/{heatmapGoals.length}</p>
                            <p className="text-[10px] text-muted-foreground">Metas com lançamento</p>
                          </div>
                          <div className="kpi-card p-3 text-center">
                            <p className={cn("text-lg font-bold", avgPct >= 90 ? "text-emerald-600" : avgPct >= 70 ? "text-amber-500" : "text-destructive")}>{avgPct}%</p>
                            <p className="text-[10px] text-muted-foreground">Atingimento médio</p>
                          </div>
                          <div className="kpi-card p-3 text-center">
                            <p className="text-lg font-bold text-foreground">{allEntryDays.size}/{daysInMonth}</p>
                            <p className="text-[10px] text-muted-foreground">Dias com lançamento</p>
                          </div>
                          <div className="kpi-card p-3 text-center">
                            <p className={cn("text-lg font-bold", coverage >= 80 ? "text-emerald-600" : coverage >= 50 ? "text-amber-500" : "text-destructive")}>{coverage}%</p>
                            <p className="text-[10px] text-muted-foreground">Cobertura do mês</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>

        <PdfExportModal
          open={pdfModalOpen}
          onOpenChange={setPdfModalOpen}
          onGenerate={handleGeneratePdf}
          generating={pdfGenerating}
          showRubricas={isAdmin}
          showMapaTermico={isAdmin}
        />
      </main>
    </div>
  );
};

export default LancamentoMetasPage;
