import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { ALL_ENTRIES, CONTRACTS, MONTHS } from "@/data/rubricaData";

const formatCurrency = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
};
const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };
const PIE_COLORS = ["hsl(var(--primary))", "hsl(38 92% 50%)", "hsl(142 71% 45%)", "hsl(280 70% 50%)", "hsl(var(--destructive))", "hsl(190 80% 45%)"];

const ControleRubricaPage = () => {
  const navigate = useNavigate();
  const [selectedContract, setSelectedContract] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");

  const filtered = useMemo(() => {
    return ALL_ENTRIES.filter(e => {
      if (selectedContract !== "all" && e.unit !== selectedContract) return false;
      if (selectedMonth !== "all" && e.month !== selectedMonth) return false;
      return true;
    });
  }, [selectedContract, selectedMonth]);

  const byRubrica = useMemo(() => {
    const map: Record<string, { allocated: number; executed: number; count: number }> = {};
    filtered.forEach(e => {
      if (!map[e.rubrica]) map[e.rubrica] = { allocated: 0, executed: 0, count: 0 };
      map[e.rubrica].allocated += e.valorAllocated;
      map[e.rubrica].executed += e.valorExecuted;
      map[e.rubrica].count += 1;
    });
    return Object.entries(map).map(([name, v]) => ({
      name,
      allocated: v.allocated,
      executed: v.executed,
      pctExec: v.allocated > 0 ? Math.round((v.executed / v.allocated) * 100) : 0,
      count: v.count,
      estourada: v.executed > v.allocated,
    })).sort((a, b) => b.allocated - a.allocated);
  }, [filtered]);

  const byMonth = useMemo(() => {
    const map: Record<string, { allocated: number; executed: number }> = {};
    const entries = ALL_ENTRIES.filter(e => selectedContract === "all" || e.unit === selectedContract);
    entries.forEach(e => {
      if (!map[e.month]) map[e.month] = { allocated: 0, executed: 0 };
      map[e.month].allocated += e.valorAllocated;
      map[e.month].executed += e.valorExecuted;
    });
    return MONTHS.map(m => ({
      month: m,
      alocado: (map[m]?.allocated || 0) / 1000,
      executado: (map[m]?.executed || 0) / 1000,
    }));
  }, [selectedContract]);

  const totalAllocated = byRubrica.reduce((s, r) => s + r.allocated, 0);
  const totalExecuted = byRubrica.reduce((s, r) => s + r.executed, 0);
  const avgExecution = totalAllocated > 0 ? Math.round((totalExecuted / totalAllocated) * 100) : 0;
  const overBudget = byRubrica.filter(r => r.estourada).length;
  const underBudget = byRubrica.filter(r => r.pctExec < 70).length;
  const pieData = byRubrica.map(r => ({ name: r.name, value: r.allocated }));

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          ← Voltar
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Controle de Rubrica</h1>
            <p className="text-sm text-muted-foreground">Gestão e acompanhamento de rubricas por contrato</p>
          </div>
          <div className="flex items-center gap-3">
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
        </div>

        {/* Estouradas alert banner */}
        {overBudget > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 mb-6 rounded-lg border border-destructive/30 bg-destructive/5"
          >
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {overBudget} rubrica{overBudget > 1 ? "s" : ""} estourada{overBudget > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {byRubrica.filter(r => r.estourada).map(r => r.name).join(", ")} — pendência de evidência de justificativa em Evidências
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => navigate("/evidencias")}>
              Ver Evidências
            </Button>
          </motion.div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="kpi-card">
              <p className="text-xs text-muted-foreground">Total alocado</p>
              <p className="font-display text-2xl font-bold text-foreground">{formatCurrency(totalAllocated)}</p>
              <p className="text-[10px] text-muted-foreground">{byRubrica.length} rubricas ativas</p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="kpi-card">
              <p className="text-xs text-muted-foreground">Total executado</p>
              <p className="font-display text-2xl font-bold" style={{ color: avgExecution >= 90 ? "hsl(142 71% 45%)" : avgExecution >= 70 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))" }}>{formatCurrency(totalExecuted)}</p>
              <p className="text-[10px] text-muted-foreground">{avgExecution}% de execução</p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="kpi-card">
              <p className="text-xs text-muted-foreground">Saldo disponível</p>
              <p className="font-display text-2xl font-bold text-foreground">{formatCurrency(totalAllocated - totalExecuted)}</p>
              <p className="text-[10px] text-muted-foreground">{100 - avgExecution}% restante</p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="kpi-card">
              <p className="text-xs text-muted-foreground">Rubricas estouradas</p>
              <div className="flex items-center gap-2">
                <p className="font-display text-2xl font-bold text-destructive">{overBudget}</p>
                {overBudget > 0 && <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />}
              </div>
              <p className="text-[10px] text-muted-foreground">{underBudget} abaixo de 70%</p>
            </div>
          </motion.div>
        </div>

        {/* Charts row */}
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

        {/* Execution by rubrica */}
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

        {/* Detailed table */}
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
                <motion.div
                  key={r.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={`grid grid-cols-12 px-4 py-3 text-sm items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${r.estourada ? "bg-destructive/5" : ""}`}
                >
                  <span className="col-span-3 font-medium text-foreground text-xs flex items-center gap-1.5">
                    {r.estourada && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                    {r.name}
                  </span>
                  <span className="col-span-2 text-right text-xs text-muted-foreground">{formatCurrency(r.allocated)}</span>
                  <span className={`col-span-2 text-right text-xs font-medium ${r.estourada ? "text-destructive" : "text-foreground"}`}>{formatCurrency(r.executed)}</span>
                  <span className={`col-span-2 text-right text-xs font-medium ${saldo < 0 ? "text-destructive" : "text-foreground"}`}>{formatCurrency(saldo)}</span>
                  <span className="col-span-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(r.pctExec, 100)}%`,
                            background: r.estourada ? "hsl(var(--destructive))" : r.pctExec >= 70 ? "hsl(var(--primary))" : "hsl(38 92% 50%)",
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{r.pctExec}%</span>
                    </div>
                  </span>
                  <span className="col-span-1 text-right">
                    <span className={`status-badge text-[10px] ${statusClass}`}>{statusLabel}</span>
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ControleRubricaPage;
