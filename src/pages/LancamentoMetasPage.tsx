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
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format, endOfMonth, isWithinInterval, parse, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_ENTRIES, CONTRACTS, MONTHS, RUBRICA_NAMES } from "@/data/rubricaData";
import GoalGauge from "@/components/GoalGauge";
import BedMovementsTab from "@/components/BedMovementsTab";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const { user, profile } = useAuth();
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

  const handleGeneratePdf = async () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const primary: [number, number, number] = [35, 66, 117];
    const lightBg: [number, number, number] = [235, 239, 245];
    const now = new Date();
    const margin = 14;
    const contentW = pageW - margin * 2;
    let pageNum = 0;

    const monthLabel = filterMonth === "todos" ? "Todos os meses" : FILTER_MONTHS.find(m => m.value === filterMonth)?.label || "";
    const filterLabel = `${filterYear} — ${monthLabel}`;

    const addHeader = (title: string) => {
      pageNum++;
      if (pageNum > 1) doc.addPage();
      doc.setFillColor(...primary);
      doc.rect(0, 0, pageW, 38, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("MOSS", margin, 18);
      doc.setFontSize(9);
      doc.text("Métricas para Organizações de Serviço Social", margin, 26);
      doc.setFontSize(11);
      doc.text(title, margin, 34);
      doc.setFontSize(8);
      doc.text(`${selectedUnit} • ${format(now, "dd/MM/yyyy HH:mm")}`, pageW - margin, 34, { align: "right" });
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.text(`Filtro: ${filterLabel}`, margin, 48);
      return 54;
    };

    const addFooter = () => {
      doc.setDrawColor(200, 210, 220);
      doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(7);
      doc.text("MOSS — Métricas para Organizações de Serviço Social", margin, pageH - 8);
      doc.text(`Página ${pageNum}`, pageW - margin, pageH - 8, { align: "right" });
    };

    const drawKpiBoxes = (kpis: { label: string; value: string }[], y: number) => {
      const boxW = (contentW - 18) / 4;
      kpis.forEach((kpi, i) => {
        const x = margin + i * (boxW + 6);
        doc.setFillColor(...lightBg);
        doc.roundedRect(x, y, boxW, 22, 3, 3, "F");
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text(kpi.label, x + 4, y + 8);
        doc.setTextColor(...primary);
        doc.setFontSize(16);
        doc.text(kpi.value, x + 4, y + 18);
      });
      return y + 30;
    };

    // ═══ PAGE 1: METAS ═══
    let startY = addHeader("Relatório de Lançamentos — Metas");

    const metaRows = goals.map(g => {
      const existing = filterEntriesByDate(existingEntries[g.id] || []);
      const total = existing.reduce((s, e) => s + e.value, 0);
      const pct = g.target > 0 ? Math.round((total / g.target) * 100) : 0;
      return { name: g.name, target: g.target, unit: g.unit, total, pct, weight: g.weight };
    });
    const totalPct = metaRows.length > 0 ? Math.round(metaRows.reduce((s, r) => s + r.pct * r.weight, 0) / Math.max(metaRows.reduce((s, r) => s + r.weight, 0), 0.01)) : 0;

    startY = drawKpiBoxes([
      { label: "Total de Metas", value: String(metaRows.length) },
      { label: "Atingimento Médio", value: `${totalPct}%` },
      { label: "Metas ≥ 100%", value: String(metaRows.filter(r => r.pct >= 100).length) },
      { label: "Metas < 70%", value: String(metaRows.filter(r => r.pct < 70).length) },
    ], startY);

    // Bar chart
    doc.setFillColor(...lightBg);
    doc.roundedRect(margin, startY, contentW, 50, 3, 3, "F");
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.text("Atingimento por Meta (%)", margin + 4, startY + 10);
    const labelW = 46;
    const barAreaW = contentW - labelW - 30;
    const barH = metaRows.length > 0 ? Math.min(6, 30 / metaRows.length) : 6;
    metaRows.forEach((r, i) => {
      const y = startY + 16 + i * (barH + 2);
      if (y + barH > startY + 48) return;
      const barX = margin + labelW;
      doc.setFillColor(220, 225, 230);
      doc.roundedRect(barX, y, barAreaW, barH, 1, 1, "F");
      const fillW = Math.min(Math.min(r.pct / 100, 1.2) * barAreaW, barAreaW);
      doc.setFillColor(r.pct >= 100 ? 46 : r.pct >= 70 ? 41 : 231, r.pct >= 100 ? 160 : r.pct >= 70 ? 128 : 76, r.pct >= 100 ? 67 : r.pct >= 70 ? 185 : 60);
      doc.roundedRect(barX, y, Math.max(fillW, 2), barH, 1, 1, "F");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(7);
      doc.text(r.name.substring(0, 18), margin + 4, y + barH - 1);
      doc.text(`${r.pct}%`, barX + barAreaW + 2, y + barH - 1);
    });
    startY += 56;

    autoTable(doc, {
      startY,
      head: [["Meta", "Alvo", "Realizado", "Atingimento", "Peso"]],
      body: metaRows.map(r => [r.name, `${r.target}${r.unit}`, `${r.total.toFixed(1)}${r.unit}`, `${r.pct}%`, `${(r.weight * 100).toFixed(0)}%`]),
      headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: lightBg },
      styles: { cellPadding: 4, lineWidth: 0.1, lineColor: [200, 210, 220] },
      margin: { left: margin, right: margin },
    });
    addFooter();

    // ═══ PAGE 2: RUBRICAS ═══
    startY = addHeader("Relatório de Lançamentos — Rubricas");

    const contract = CONTRACTS.find(c => c.id === selectedContract);
    if (contract) {
      const rubRows = RUBRICA_NAMES.map(r => {
        const entry = ALL_ENTRIES.find(e => e.unit === contract.unit && e.month === selectedMonth && e.rubrica === r);
        const alloc = entry?.valorAllocated || 0;
        const exec = entry?.valorExecuted || 0;
        const pct = alloc > 0 ? Math.round((exec / alloc) * 100) : 0;
        return { name: r, alloc, exec, pct };
      });
      const totalAlloc = rubRows.reduce((s, r) => s + r.alloc, 0);
      const totalExec = rubRows.reduce((s, r) => s + r.exec, 0);
      const avgPct = totalAlloc > 0 ? Math.round((totalExec / totalAlloc) * 100) : 0;

      startY = drawKpiBoxes([
        { label: "Total Alocado", value: formatCurrency(totalAlloc) },
        { label: "Total Executado", value: formatCurrency(totalExec) },
        { label: "Execução", value: `${avgPct}%` },
        { label: "Estouradas", value: String(rubRows.filter(r => r.pct > 100).length) },
      ], startY);

      doc.setFillColor(...lightBg);
      doc.roundedRect(margin, startY, contentW, 50, 3, 3, "F");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      doc.text("Execução por Rubrica (%)", margin + 4, startY + 10);
      const colors: [number, number, number][] = [[26, 54, 71], [41, 128, 185], [46, 160, 67], [142, 68, 173], [231, 76, 60], [52, 152, 219]];
      const rubBarAreaW2 = contentW - 80;
      rubRows.forEach((r, i) => {
        const y = startY + 16 + i * 5;
        if (y > startY + 46) return;
        doc.setFillColor(...(colors[i % colors.length]));
        const barW2 = Math.min((r.pct / 120) * rubBarAreaW2, rubBarAreaW2);
        doc.roundedRect(margin + 4, y, Math.max(barW2, 2), 3.5, 1, 1, "F");
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(6.5);
        doc.text(`${r.name} (${r.pct}%)`, margin + 8 + barW2, y + 3);
      });
      startY += 56;

      autoTable(doc, {
        startY,
        head: [["Rubrica", "Alocado", "Executado", "% Exec"]],
        body: rubRows.map(r => [r.name, formatCurrency(r.alloc), formatCurrency(r.exec), `${r.pct}%`]),
        headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: lightBg },
        styles: { cellPadding: 4, lineWidth: 0.1, lineColor: [200, 210, 220] },
        margin: { left: margin, right: margin },
      });
    }
    addFooter();

    // ═══ PAGE 3: MOVIMENTAÇÃO DE LEITOS ═══
    startY = addHeader("Relatório de Lançamentos — Movimentação de Leitos");

    // Fetch bed movements for the filtered period
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
    const avgOccRate = totalBedsForUnit > 0 ? ((totalOcc / totalBedsForUnit) * 100).toFixed(1) : "0";
    const giro = totalInternacaoForUnit > 0 ? ((totalDis + totalDea) / totalInternacaoForUnit).toFixed(2) : "0";

    startY = drawKpiBoxes([
      { label: "Ocupação Média", value: `${avgOccRate}%` },
      { label: "Giro de Leitos", value: giro },
      { label: "Total Internações", value: String(totalAdm) },
      { label: "Total Saídas", value: String(totalDis + totalDea) },
    ], startY);

    // Occupancy trend chart simulation
    if (dateEntries.length > 0) {
      const chartH = 45;
      doc.setFillColor(...lightBg);
      doc.roundedRect(margin, startY, contentW, chartH + 15, 3, 3, "F");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      doc.text("Tendência de Ocupação (%)", margin + 4, startY + 10);

      const chartStartX = margin + 8;
      const chartW = contentW - 16;
      const chartStartY2 = startY + 14;
      const maxVal = 100;

      // Grid lines
      doc.setDrawColor(210, 215, 220);
      for (let g = 0; g <= 4; g++) {
        const gy = chartStartY2 + (chartH / 4) * g;
        doc.line(chartStartX, gy, chartStartX + chartW, gy);
        doc.setTextColor(160, 160, 160);
        doc.setFontSize(6);
        doc.text(`${100 - g * 25}%`, chartStartX - 1, gy + 1, { align: "right" });
      }

      // Plot line
      if (dateEntries.length > 1) {
        const step = chartW / (dateEntries.length - 1);
        doc.setDrawColor(...primary);
        doc.setLineWidth(0.8);
        for (let i = 1; i < dateEntries.length; i++) {
          const prevRate = totalBedsForUnit > 0 ? (dateEntries[i - 1][1].occupied / totalBedsForUnit) * 100 : 0;
          const currRate = totalBedsForUnit > 0 ? (dateEntries[i][1].occupied / totalBedsForUnit) * 100 : 0;
          const x1 = chartStartX + (i - 1) * step;
          const y1 = chartStartY2 + chartH - (prevRate / maxVal) * chartH;
          const x2 = chartStartX + i * step;
          const y2 = chartStartY2 + chartH - (currRate / maxVal) * chartH;
          doc.line(x1, y1, x2, y2);
        }
        doc.setLineWidth(0.2);
      }

      // X-axis labels (first, mid, last)
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(6);
      if (dateEntries.length > 0) {
        doc.text(format(new Date(dateEntries[0][0] + "T00:00:00"), "dd/MM"), chartStartX, chartStartY2 + chartH + 6);
        if (dateEntries.length > 2) {
          const mid = Math.floor(dateEntries.length / 2);
          doc.text(format(new Date(dateEntries[mid][0] + "T00:00:00"), "dd/MM"), chartStartX + chartW / 2, chartStartY2 + chartH + 6, { align: "center" });
        }
        doc.text(format(new Date(dateEntries[dateEntries.length - 1][0] + "T00:00:00"), "dd/MM"), chartStartX + chartW, chartStartY2 + chartH + 6, { align: "right" });
      }

      startY += chartH + 22;
    }

    // Movements table
    if (dateEntries.length > 0) {
      autoTable(doc, {
        startY,
        head: [["Data", "Ocupados", "Internações", "Altas", "Óbitos", "Transf.", "Ocupação"]],
        body: dateEntries.map(([date, d]) => [
          format(new Date(date + "T00:00:00"), "dd/MM/yyyy"),
          String(d.occupied), String(d.admissions), String(d.discharges), String(d.deaths), String(d.transfers),
          totalBedsForUnit > 0 ? `${((d.occupied / totalBedsForUnit) * 100).toFixed(1)}%` : "0%",
        ]),
        headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: lightBg },
        styles: { cellPadding: 3, lineWidth: 0.1, lineColor: [200, 210, 220] },
        margin: { left: margin, right: margin },
      });
    } else {
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(10);
      doc.text("Nenhuma movimentação registrada no período.", margin, startY + 10);
    }
    addFooter();

    doc.save(`lancamentos_${format(now, "yyyyMMdd_HHmm")}.pdf`);
    toast.success("PDF gerado com sucesso!");
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
  const [selectedContract, setSelectedContract] = useState(CONTRACTS[0].id);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0]);
  const [rubricaEntries, setRubricaEntries] = useState<Record<string, EntryForm>>({});
  const [rubricaSubmitting, setRubricaSubmitting] = useState<string | null>(null);

  const handleRubricaSubmit = async (key: string, rubName: string, contract: typeof CONTRACTS[0]) => {
    const entry = rubricaEntries[key];
    if (!entry?.value || !entry?.period) { toast.error("Preencha o valor e a data"); return; }
    setRubricaSubmitting(key);
    // For now, just show success (mock — would insert into a rubrica_entries table)
    toast.success(`Lançamento de ${rubName} (${contract.unit}) salvo`);
    setRubricaEntries(prev => ({ ...prev, [key]: { value: "", period: "", notes: "" } }));
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
            {(activeTab === "lancar-metas" || activeTab === "lancar-leitos") && (
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
                  <SelectContent>{CONTRACTS.map(c => <SelectItem key={c.id} value={c.id}>{c.unit}</SelectItem>)}</SelectContent>
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
            <Button variant="outline" size="sm" className="h-9" onClick={handleGeneratePdf}>
              Gerar PDF
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="lancar-metas">Lançamento de Metas</TabsTrigger>
            <TabsTrigger value="lancamento-rubricas">Lançamento de Rubricas</TabsTrigger>
            <TabsTrigger value="lancar-leitos">Movimentação de Leitos</TabsTrigger>
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
                {goals.map((goal, i) => {
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
                                <p className="text-xs text-muted-foreground mt-0.5">Meta: {goal.target}{goal.unit} — Peso: {(goal.weight * 100).toFixed(0)}%</p>
                              </div>
                              <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded">{goal.type}</span>
                            </div>
                            <div className="flex justify-center">
                              <GoalGauge percent={attainment} size={100} />
                            </div>
                            <div className="bg-secondary/50 rounded-lg p-2 text-center mb-2">
                              <p className="text-[10px] text-muted-foreground">
                                Faltam <span className="font-semibold text-foreground">{remaining.toFixed(1)}{goal.unit}</span>
                                {endDate && daysRemaining > 0 ? (
                                  <> • Meta diária: <span className="font-semibold text-foreground">{dailyGoal.toFixed(2)}{goal.unit}/dia</span> ({daysRemaining}d)</>
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
              const contract = CONTRACTS.find(c => c.id === selectedContract);
              if (!contract) return <p className="text-muted-foreground text-center py-12">Selecione um contrato</p>;

              // Get current entries for this contract+month
              const currentEntries = ALL_ENTRIES.filter(e => e.unit === contract.unit && e.month === selectedMonth);

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {RUBRICA_NAMES.map((rubName, i) => {
                    const existing = currentEntries.find(e => e.rubrica === rubName);
                    const allocated = existing?.valorAllocated || 0;
                    const executed = existing?.valorExecuted || 0;
                    const pctExec = allocated > 0 ? Math.round((executed / allocated) * 100) : 0;
                    const estourada = executed > allocated;
                    const rubEntryKey = `${selectedContract}-${rubName}-${selectedMonth}`;
                    const rubEntry = rubricaEntries[rubEntryKey] || { value: "", period: "", notes: "" };

                    return (
                      <motion.div key={rubName} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="kpi-card">
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <h3 className="font-display font-semibold text-foreground text-sm">{rubName}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Alocado: {formatCurrency(allocated)} — {existing?.percentAllocated || 0}% do contrato
                            </p>
                          </div>
                          <span className={`status-badge text-[10px] ${estourada ? "status-critical" : pctExec >= 70 ? "status-success" : "status-warning"}`}>
                            {pctExec}%
                          </span>
                        </div>

                        {/* Gauge */}
                        <div className="flex justify-center">
                          <GoalGauge percent={pctExec} size={100} />
                        </div>

                        <div className="bg-secondary/50 rounded-lg p-2 text-center mb-2">
                          <p className="text-[10px] text-muted-foreground">
                            Executado: <span className={`font-semibold ${estourada ? "text-destructive" : "text-foreground"}`}>{formatCurrency(executed)}</span>
                            {" • "}Saldo: <span className={`font-semibold ${estourada ? "text-destructive" : "text-foreground"}`}>{formatCurrency(allocated - executed)}</span>
                          </p>
                        </div>

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
                            onClick={() => handleRubricaSubmit(rubEntryKey, rubName, contract)}
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
        </Tabs>
      </main>
    </div>
  );
};

export default LancamentoMetasPage;
