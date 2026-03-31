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
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_ENTRIES, CONTRACTS, MONTHS, RUBRICA_NAMES } from "@/data/rubricaData";
import GoalGauge from "@/components/GoalGauge";

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
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Contrato</label>
                <Select value={selectedContract} onValueChange={setSelectedContract}>
                  <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRACTS.map(c => <SelectItem key={c.id} value={c.id}>{c.unit}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Mês</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
