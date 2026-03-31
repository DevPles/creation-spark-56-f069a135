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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { ALL_ENTRIES, CONTRACTS, MONTHS } from "@/data/rubricaData";

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

  const UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];

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
  const [selectedContract, setSelectedContract] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");

  const filtered = useMemo(() => ALL_ENTRIES.filter(e => {
    if (selectedContract !== "all" && e.unit !== selectedContract) return false;
    if (selectedMonth !== "all" && e.month !== selectedMonth) return false;
    return true;
  }), [selectedContract, selectedMonth]);

  const byRubrica = useMemo(() => {
    const map: Record<string, { allocated: number; executed: number }> = {};
    filtered.forEach(e => {
      if (!map[e.rubrica]) map[e.rubrica] = { allocated: 0, executed: 0 };
      map[e.rubrica].allocated += e.valorAllocated;
      map[e.rubrica].executed += e.valorExecuted;
    });
    return Object.entries(map).map(([name, v]) => ({
      name, allocated: v.allocated, executed: v.executed,
      pctExec: v.allocated > 0 ? Math.round((v.executed / v.allocated) * 100) : 0,
      estourada: v.executed > v.allocated,
    })).sort((a, b) => b.allocated - a.allocated);
  }, [filtered]);

  const byMonth = useMemo(() => {
    const map: Record<string, { allocated: number; executed: number }> = {};
    const ent = ALL_ENTRIES.filter(e => selectedContract === "all" || e.unit === selectedContract);
    ent.forEach(e => {
      if (!map[e.month]) map[e.month] = { allocated: 0, executed: 0 };
      map[e.month].allocated += e.valorAllocated;
      map[e.month].executed += e.valorExecuted;
    });
    return MONTHS.map(m => ({ month: m, alocado: (map[m]?.allocated || 0) / 1000, executado: (map[m]?.executed || 0) / 1000 }));
  }, [selectedContract]);

  const totalAllocated = byRubrica.reduce((s, r) => s + r.allocated, 0);
  const totalExecuted = byRubrica.reduce((s, r) => s + r.executed, 0);
  const avgExecution = totalAllocated > 0 ? Math.round((totalExecuted / totalAllocated) * 100) : 0;
  const overBudget = byRubrica.filter(r => r.estourada).length;
  const underBudget = byRubrica.filter(r => r.pctExec < 70).length;
  const pieData = byRubrica.map(r => ({ name: r.name, value: r.allocated }));

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
          {activeTab === "lancar-metas" && (
            isAdmin ? (
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2">
                <p className="text-xs text-muted-foreground">Sua unidade</p>
                <p className="font-display font-semibold text-foreground text-sm">{profile?.facility_unit || "Carregando..."}</p>
              </div>
            )
          )}
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
                  const existing = existingEntries[goal.id] || [];
                  return (
                    <motion.div key={goal.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="kpi-card">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-display font-semibold text-foreground text-sm">{goal.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Meta: {goal.target}{goal.unit} — Peso: {(goal.weight * 100).toFixed(0)}%</p>
                        </div>
                        <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded">{goal.type}</span>
                      </div>
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
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Select value={selectedContract} onValueChange={setSelectedContract}>
                <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os contratos</SelectItem>
                  {CONTRACTS.map(c => <SelectItem key={c.id} value={c.unit}>{c.unit}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {overBudget > 0 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 mb-6 rounded-lg border border-destructive/30 bg-destructive/5">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">{overBudget} rubrica{overBudget > 1 ? "s" : ""} estourada{overBudget > 1 ? "s" : ""}</p>
                  <p className="text-xs text-muted-foreground">{byRubrica.filter(r => r.estourada).map(r => r.name).join(", ")}</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => navigate("/evidencias")}>Ver Evidências</Button>
              </motion.div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="kpi-card">
                <p className="text-xs text-muted-foreground">Total alocado</p>
                <p className="font-display text-2xl font-bold text-foreground">{formatCurrency(totalAllocated)}</p>
                <p className="text-[10px] text-muted-foreground">{byRubrica.length} rubricas ativas</p>
              </div>
              <div className="kpi-card">
                <p className="text-xs text-muted-foreground">Total executado</p>
                <p className="font-display text-2xl font-bold" style={{ color: avgExecution >= 90 ? "hsl(142 71% 45%)" : avgExecution >= 70 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))" }}>{formatCurrency(totalExecuted)}</p>
                <p className="text-[10px] text-muted-foreground">{avgExecution}% de execução</p>
              </div>
              <div className="kpi-card">
                <p className="text-xs text-muted-foreground">Saldo disponível</p>
                <p className="font-display text-2xl font-bold text-foreground">{formatCurrency(totalAllocated - totalExecuted)}</p>
                <p className="text-[10px] text-muted-foreground">{100 - avgExecution}% restante</p>
              </div>
              <div className="kpi-card">
                <p className="text-xs text-muted-foreground">Rubricas estouradas</p>
                <div className="flex items-center gap-2">
                  <p className="font-display text-2xl font-bold text-destructive">{overBudget}</p>
                  {overBudget > 0 && <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />}
                </div>
                <p className="text-[10px] text-muted-foreground">{underBudget} abaixo de 70%</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="kpi-card">
                <p className="text-sm font-medium text-foreground mb-3">Distribuição por rubrica</p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="kpi-card">
                <p className="text-sm font-medium text-foreground mb-3">Alocado vs Executado (R$ mil)</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byMonth} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickFormatter={v => `${v}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `R$ ${v.toFixed(0)}k`} />
                    <Bar dataKey="alocado" fill="hsl(var(--primary) / 0.3)" radius={[6, 6, 0, 0]} name="Alocado" />
                    <Bar dataKey="executado" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Executado" />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Execution bar */}
            <div className="kpi-card mb-6">
              <p className="text-sm font-medium text-foreground mb-3">Execução por rubrica</p>
              <ResponsiveContainer width="100%" height={Math.max(200, byRubrica.length * 45)}>
                <BarChart data={byRubrica.map(r => ({ name: r.name, execução: r.pctExec }))} layout="vertical" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" domain={[0, 120]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="execução" radius={[0, 6, 6, 0]} name="% Executado">
                    {byRubrica.map((r, i) => (
                      <Cell key={i} fill={r.estourada ? "hsl(var(--destructive))" : r.pctExec >= 70 ? "hsl(var(--primary))" : "hsl(38 92% 50%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="kpi-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">Detalhamento por rubrica</p>
                <span className="text-xs text-muted-foreground">{byRubrica.length} rubricas</span>
              </div>
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] font-medium text-muted-foreground border-b border-border">
                  <span className="col-span-3">Rubrica</span>
                  <span className="col-span-2 text-right">Alocado</span>
                  <span className="col-span-2 text-right">Executado</span>
                  <span className="col-span-2 text-right">Saldo</span>
                  <span className="col-span-2 text-right">Execução</span>
                  <span className="col-span-1 text-right">Status</span>
                </div>
                {byRubrica.map((r, i) => {
                  const saldo = r.allocated - r.executed;
                  const statusClass = r.estourada ? "status-critical" : r.pctExec >= 70 ? "status-success" : "status-warning";
                  const statusLabel = r.estourada ? "Estourada" : r.pctExec >= 70 ? "OK" : "Baixo";
                  return (
                    <motion.div key={r.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className={`grid grid-cols-12 px-4 py-3 text-sm items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${r.estourada ? "bg-destructive/5" : ""}`}>
                      <span className="col-span-3 font-medium text-foreground text-xs flex items-center gap-1.5">
                        {r.estourada && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}{r.name}
                      </span>
                      <span className="col-span-2 text-right text-xs text-muted-foreground">{formatCurrency(r.allocated)}</span>
                      <span className={`col-span-2 text-right text-xs font-medium ${r.estourada ? "text-destructive" : "text-foreground"}`}>{formatCurrency(r.executed)}</span>
                      <span className={`col-span-2 text-right text-xs font-medium ${saldo < 0 ? "text-destructive" : "text-foreground"}`}>{formatCurrency(saldo)}</span>
                      <span className="col-span-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(r.pctExec, 100)}%`, background: r.estourada ? "hsl(var(--destructive))" : r.pctExec >= 70 ? "hsl(var(--primary))" : "hsl(38 92% 50%)" }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{r.pctExec}%</span>
                        </div>
                      </span>
                      <span className="col-span-1 text-right"><span className={`status-badge text-[10px] ${statusClass}`}>{statusLabel}</span></span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default LancamentoMetasPage;
