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
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_ENTRIES, CONTRACTS, MONTHS, RUBRICA_NAMES } from "@/data/rubricaData";
import GoalGauge from "@/components/GoalGauge";
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
  const [dateFilter, setDateFilter] = useState<string>("todos");

  const UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];

  const getDateRange = (filter: string): { start: Date; end: Date } | null => {
    const now = new Date();
    switch (filter) {
      case "hoje": return { start: new Date(now.setHours(0,0,0,0)), end: new Date() };
      case "7d": return { start: subDays(new Date(), 7), end: new Date() };
      case "30d": return { start: subDays(new Date(), 30), end: new Date() };
      case "mes": return { start: startOfMonth(new Date()), end: endOfMonth(new Date()) };
      default: return null;
    }
  };

  const filterEntriesByDate = (entryList: { value: number; period: string }[]) => {
    const range = getDateRange(dateFilter);
    if (!range) return entryList;
    return entryList.filter(e => {
      try {
        const d = parse(e.period, "dd/MM/yyyy", new Date());
        return isWithinInterval(d, range);
      } catch { return true; }
    });
  };

  const handleGeneratePdf = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const primary: [number, number, number] = [26, 54, 71];
    const accent: [number, number, number] = [41, 128, 185];
    const lightBg: [number, number, number] = [240, 245, 250];
    const now = new Date();

    const margin = 14;
    const contentW = pageW - margin * 2;

    // Header band
    doc.setFillColor(...primary);
    doc.rect(0, 0, pageW, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("MOSS", margin, 18);
    doc.setFontSize(9);
    doc.text("Métricas para Organizações de Serviço Social", margin, 26);
    doc.setFontSize(11);
    doc.text("Relatório de Lançamentos", margin, 34);
    doc.setFontSize(8);
    doc.text(`${selectedUnit} • ${format(now, "dd/MM/yyyy HH:mm")}`, pageW - margin, 34, { align: "right" });

    // Filter info
    const filterLabel = dateFilter === "todos" ? "Todos os períodos" : dateFilter === "hoje" ? "Hoje" : dateFilter === "7d" ? "Últimos 7 dias" : dateFilter === "30d" ? "Últimos 30 dias" : "Este mês";
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(`Filtro: ${filterLabel}`, margin, 48);

    let startY = 54;

    if (activeTab === "lancar-metas") {
      // KPI summary cards
      const metaRows = goals.map(g => {
        const existing = filterEntriesByDate(existingEntries[g.id] || []);
        const total = existing.reduce((s, e) => s + e.value, 0);
        const pct = g.target > 0 ? Math.round((total / g.target) * 100) : 0;
        return { name: g.name, target: g.target, unit: g.unit, total, pct, weight: g.weight };
      });

      const totalPct = metaRows.length > 0 ? Math.round(metaRows.reduce((s, r) => s + r.pct * r.weight, 0) / Math.max(metaRows.reduce((s, r) => s + r.weight, 0), 0.01)) : 0;

      // KPI boxes
      const kpis = [
        { label: "Total de Metas", value: String(metaRows.length) },
        { label: "Atingimento Médio", value: `${totalPct}%` },
        { label: "Metas ≥ 100%", value: String(metaRows.filter(r => r.pct >= 100).length) },
        { label: "Metas < 70%", value: String(metaRows.filter(r => r.pct < 70).length) },
      ];
      const boxW = (contentW - 18) / 4;
      kpis.forEach((kpi, i) => {
        const x = margin + i * (boxW + 6);
        doc.setFillColor(...lightBg);
        doc.roundedRect(x, startY, boxW, 22, 3, 3, "F");
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text(kpi.label, x + 4, startY + 8);
        doc.setTextColor(...primary);
        doc.setFontSize(16);
        doc.text(kpi.value, x + 4, startY + 18);
      });
      startY += 30;

      // Bar chart simulation
      doc.setFillColor(...lightBg);
      doc.roundedRect(margin, startY, contentW, 50, 3, 3, "F");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      doc.text("Atingimento por Meta (%)", margin + 4, startY + 10);

      const chartStartY = startY + 16;
      const labelW = 46;
      const barAreaW = contentW - labelW - 30;
      const barH = metaRows.length > 0 ? Math.min(6, 30 / metaRows.length) : 6;
      metaRows.forEach((r, i) => {
        const y = chartStartY + i * (barH + 2);
        if (y + barH > startY + 48) return;
        const barX = margin + labelW;
        // Background bar
        doc.setFillColor(220, 225, 230);
        doc.roundedRect(barX, y, barAreaW, barH, 1, 1, "F");
        // Fill bar (clamped to barAreaW)
        const fillW = Math.min(Math.min(r.pct / 100, 1.2) * barAreaW, barAreaW);
        doc.setFillColor(r.pct >= 100 ? 46 : r.pct >= 70 ? 41 : 231, r.pct >= 100 ? 160 : r.pct >= 70 ? 128 : 76, r.pct >= 100 ? 67 : r.pct >= 70 ? 185 : 60);
        doc.roundedRect(barX, y, Math.max(fillW, 2), barH, 1, 1, "F");
        // Label
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(7);
        doc.text(r.name.substring(0, 18), margin + 4, y + barH - 1);
        doc.text(`${r.pct}%`, barX + barAreaW + 2, y + barH - 1);
      });
      startY += 56;

      // Table
      const rows = metaRows.map(r => [r.name, `${r.target}${r.unit}`, `${r.total.toFixed(1)}${r.unit}`, `${r.pct}%`, `${(r.weight * 100).toFixed(0)}%`]);
      autoTable(doc, {
        startY,
        head: [["Meta", "Alvo", "Realizado", "Atingimento", "Peso"]],
        body: rows,
        headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: lightBg },
        styles: { cellPadding: 4, lineWidth: 0.1, lineColor: [200, 210, 220] },
        margin: { left: margin, right: margin },
      });
    } else {
      const contract = CONTRACTS.find(c => c.id === selectedContract);
      if (contract) {
        const rows = RUBRICA_NAMES.map(r => {
          const entry = ALL_ENTRIES.find(e => e.unit === contract.unit && e.month === selectedMonth && e.rubrica === r);
          const alloc = entry?.valorAllocated || 0;
          const exec = entry?.valorExecuted || 0;
          const pct = alloc > 0 ? Math.round((exec / alloc) * 100) : 0;
          return { name: r, alloc, exec, pct };
        });

        // KPI boxes
        const totalAlloc = rows.reduce((s, r) => s + r.alloc, 0);
        const totalExec = rows.reduce((s, r) => s + r.exec, 0);
        const avgPct = totalAlloc > 0 ? Math.round((totalExec / totalAlloc) * 100) : 0;
        const kpis = [
          { label: "Total Alocado", value: formatCurrency(totalAlloc) },
          { label: "Total Executado", value: formatCurrency(totalExec) },
          { label: "Execução", value: `${avgPct}%` },
          { label: "Estouradas", value: String(rows.filter(r => r.pct > 100).length) },
        ];
        const boxW = (pageW - 28 - 18) / 4;
        kpis.forEach((kpi, i) => {
          const x = 14 + i * (boxW + 6);
          doc.setFillColor(...lightBg);
          doc.roundedRect(x, startY, boxW, 22, 3, 3, "F");
          doc.setTextColor(100, 100, 100);
          doc.setFontSize(8);
          doc.text(kpi.label, x + 4, startY + 8);
          doc.setTextColor(...primary);
          doc.setFontSize(16);
          doc.text(kpi.value, x + 4, startY + 18);
        });
        startY += 30;

        // Pie chart simulation
        doc.setFillColor(...lightBg);
        doc.roundedRect(14, startY, pageW - 28, 50, 3, 3, "F");
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(9);
        doc.text("Execução por Rubrica (%)", 18, startY + 10);
        const colors: [number, number, number][] = [[26, 54, 71], [41, 128, 185], [46, 160, 67], [142, 68, 173], [231, 76, 60], [52, 152, 219]];
        rows.forEach((r, i) => {
          const y = startY + 16 + i * 5;
          if (y > startY + 46) return;
          doc.setFillColor(...(colors[i % colors.length]));
          doc.roundedRect(18, y, Math.min(r.pct, 120) * 0.8, 3.5, 1, 1, "F");
          doc.setTextColor(60, 60, 60);
          doc.setFontSize(6.5);
          doc.text(`${r.name} (${r.pct}%)`, 18 + Math.min(r.pct, 120) * 0.8 + 4, y + 3);
        });
        startY += 56;

        // Table
        autoTable(doc, {
          startY,
          head: [["Rubrica", "Alocado", "Executado", "% Exec"]],
          body: rows.map(r => [r.name, formatCurrency(r.alloc), formatCurrency(r.exec), `${r.pct}%`]),
          headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold" },
          bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
          alternateRowStyles: { fillColor: lightBg },
          styles: { cellPadding: 4, lineWidth: 0.1, lineColor: [200, 210, 220] },
          margin: { left: 14, right: 14 },
        });
      }
    }

    // Footer
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200, 210, 220);
    doc.line(14, pageH - 14, pageW - 14, pageH - 14);
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.text("Larilu — Sistema de Gestão Hospitalar", 14, pageH - 8);
    doc.text(`Página 1 de 1`, pageW - 14, pageH - 8, { align: "right" });

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
          ← Voltar
        </Button>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Lançamentos</h1>
            <p className="text-sm text-muted-foreground">Lançamento de metas e rubricas</p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            {activeTab === "lancar-metas" && (
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
            {activeTab === "lancamento-rubricas" && (
              <>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Contrato</label>
                  <Select value={selectedContract} onValueChange={setSelectedContract}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTRACTS.map(c => <SelectItem key={c.id} value={c.id}>{c.unit}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Mês</label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Período</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="mes">Este mês</SelectItem>
                </SelectContent>
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
                    <motion.div key={goal.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="kpi-card">
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
                      <div className="space-y-2">
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
        </Tabs>
      </main>
    </div>
  );
};

export default LancamentoMetasPage;
