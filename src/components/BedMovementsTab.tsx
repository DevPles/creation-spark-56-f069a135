import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

interface BedRow {
  category: string;
  specialty: string;
  quantity: number;
}

interface MovementForm {
  occupied: number;
  admissions: number;
  discharges: number;
  deaths: number;
  transfers: number;
}

interface BedMovement {
  id: string;
  facility_unit: string;
  category: string;
  specialty: string;
  movement_date: string;
  occupied: number;
  admissions: number;
  discharges: number;
  deaths: number;
  transfers: number;
  user_id: string;
  notes: string | null;
  created_at: string;
}

interface Props {
  selectedUnit: string;
  onUnitChange: (unit: string) => void;
  isAdmin: boolean;
  filterYear: string;
  filterMonth: string;
}

const UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];
const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

const BedMovementsTab = ({ selectedUnit, onUnitChange, isAdmin, filterYear, filterMonth }: Props) => {
  const { user, profile } = useAuth();
  const [beds, setBeds] = useState<BedRow[]>([]);
  const [movementDate, setMovementDate] = useState<Date>(new Date());
  const [forms, setForms] = useState<Record<string, MovementForm>>({});
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<BedMovement[]>([]);
  const [daysWithData, setDaysWithData] = useState<Set<string>>(new Set());
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<MovementForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleSaveEdit = async (date: string) => {
    if (!user || !editingValues) return;
    setSavingEdit(true);
    const dateMovements = history.filter(m => m.movement_date === date);
    if (dateMovements.length === 1) {
      await supabase.from("bed_movements").update({
        occupied: editingValues.occupied, admissions: editingValues.admissions,
        discharges: editingValues.discharges, deaths: editingValues.deaths, transfers: editingValues.transfers,
      }).eq("id", dateMovements[0].id);
    } else if (dateMovements.length > 1) {
      for (let i = 0; i < dateMovements.length; i++) {
        if (i === 0) {
          await supabase.from("bed_movements").update({
            occupied: editingValues.occupied, admissions: editingValues.admissions,
            discharges: editingValues.discharges, deaths: editingValues.deaths, transfers: editingValues.transfers,
          }).eq("id", dateMovements[i].id);
        } else {
          await supabase.from("bed_movements").update({
            occupied: 0, admissions: 0, discharges: 0, deaths: 0, transfers: 0,
          }).eq("id", dateMovements[i].id);
        }
      }
    }
    toast.success("Movimentação atualizada!");
    setEditingDate(null);
    setEditingValues(null);
    setSavingEdit(false);
    loadHistory();
    loadMovements();
  };

  useEffect(() => {
    if (!selectedUnit) return;
    supabase.from("beds").select("category, specialty, quantity").eq("facility_unit", selectedUnit)
      .then(({ data }) => setBeds((data as BedRow[]) || []));
  }, [selectedUnit]);

  const loadMovements = useCallback(async () => {
    if (!selectedUnit) return;
    const dateStr = format(movementDate, "yyyy-MM-dd");
    const { data } = await supabase.from("bed_movements").select("*")
      .eq("facility_unit", selectedUnit)
      .eq("movement_date", dateStr);

    const movements = (data as BedMovement[]) || [];
    const newForms: Record<string, MovementForm> = {};
    beds.forEach(b => {
      const key = `${b.category}-${b.specialty}`;
      const existing = movements.find(m => m.category === b.category && m.specialty === b.specialty);
      newForms[key] = existing
        ? { occupied: existing.occupied, admissions: existing.admissions, discharges: existing.discharges, deaths: existing.deaths, transfers: existing.transfers }
        : { occupied: 0, admissions: 0, discharges: 0, deaths: 0, transfers: 0 };
    });
    setForms(newForms);
  }, [selectedUnit, movementDate, beds]);

  useEffect(() => { loadMovements(); }, [loadMovements]);

  // Load month history
  const loadHistory = useCallback(async () => {
    if (!selectedUnit) return;
    const year = Number(filterYear);
    const month = filterMonth === "todos" ? undefined : Number(filterMonth);
    const startDate = month !== undefined ? `${year}-${String(month + 1).padStart(2, "0")}-01` : `${year}-01-01`;
    const endDate = month !== undefined
      ? `${year}-${String(month + 1).padStart(2, "0")}-${getDaysInMonth(new Date(year, month))}`
      : `${year}-12-31`;

    const { data } = await supabase.from("bed_movements").select("*")
      .eq("facility_unit", selectedUnit)
      .gte("movement_date", startDate)
      .lte("movement_date", endDate)
      .order("movement_date", { ascending: false });

    const movements = (data as BedMovement[]) || [];
    setHistory(movements);
    setDaysWithData(new Set(movements.map(m => m.movement_date)));
  }, [selectedUnit, filterYear, filterMonth]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const totalBeds = useMemo(() => beds.reduce((s, b) => s + b.quantity, 0), [beds]);
  const totalInternacao = useMemo(() => beds.filter(b => b.category === "internacao").reduce((s, b) => s + b.quantity, 0), [beds]);

  const totalOccupied = useMemo(() => Object.values(forms).reduce((s, f) => s + f.occupied, 0), [forms]);
  const totalAdmissions = useMemo(() => Object.values(forms).reduce((s, f) => s + f.admissions, 0), [forms]);
  const totalDischarges = useMemo(() => Object.values(forms).reduce((s, f) => s + f.discharges, 0), [forms]);
  const totalDeaths = useMemo(() => Object.values(forms).reduce((s, f) => s + f.deaths, 0), [forms]);
  const totalTransfers = useMemo(() => Object.values(forms).reduce((s, f) => s + f.transfers, 0), [forms]);

  const occupancyRate = totalBeds > 0 ? ((totalOccupied / totalBeds) * 100).toFixed(1) : "0";
  const turnover = totalInternacao > 0 ? ((totalDischarges + totalDeaths) / totalInternacao).toFixed(2) : "0";
  const dailyBalance = totalAdmissions - (totalDischarges + totalDeaths + totalTransfers);

  const updateForm = (key: string, field: keyof MovementForm, value: string) => {
    setForms(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: Math.max(0, parseInt(value) || 0) },
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const dateStr = format(movementDate, "yyyy-MM-dd");

    for (const bed of beds) {
      const key = `${bed.category}-${bed.specialty}`;
      const form = forms[key];
      if (!form) continue;

      const { data: existing } = await supabase.from("bed_movements").select("id")
        .eq("facility_unit", selectedUnit)
        .eq("category", bed.category)
        .eq("specialty", bed.specialty)
        .eq("movement_date", dateStr)
        .maybeSingle();

      if (existing) {
        await supabase.from("bed_movements").update({
          occupied: form.occupied, admissions: form.admissions, discharges: form.discharges, deaths: form.deaths, transfers: form.transfers,
        }).eq("id", existing.id);
      } else {
        await supabase.from("bed_movements").insert({
          facility_unit: selectedUnit, category: bed.category, specialty: bed.specialty, movement_date: dateStr,
          occupied: form.occupied, admissions: form.admissions, discharges: form.discharges, deaths: form.deaths, transfers: form.transfers, user_id: user.id,
        });
      }
    }

    toast.success("Movimentação salva com sucesso!");
    setSaving(false);
    loadMovements();
    loadHistory();
  };

  const groupedBeds = useMemo(() => {
    const groups: Record<string, BedRow[]> = {};
    beds.forEach(b => { if (!groups[b.category]) groups[b.category] = []; groups[b.category].push(b); });
    return groups;
  }, [beds]);

  const categoryLabel = (cat: string) => cat === "internacao" ? "Internação" : cat === "complementar" ? "Complementar" : cat;

  // Aggregate history by date
  const historyByDate = useMemo(() => {
    const map = new Map<string, { date: string; occupied: number; admissions: number; discharges: number; deaths: number; transfers: number }>();
    history.forEach(m => {
      const existing = map.get(m.movement_date) || { date: m.movement_date, occupied: 0, admissions: 0, discharges: 0, deaths: 0, transfers: 0 };
      existing.occupied += m.occupied; existing.admissions += m.admissions; existing.discharges += m.discharges;
      existing.deaths += m.deaths; existing.transfers += m.transfers;
      map.set(m.movement_date, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [history]);

  // Chart data
  const chartData = useMemo(() => historyByDate.map(row => ({
    name: format(new Date(row.date + "T00:00:00"), "dd/MM"),
    ocupados: row.occupied,
    internacoes: row.admissions,
    altas: row.discharges,
    obitos: row.deaths,
    ocupacao: totalBeds > 0 ? Number(((row.occupied / totalBeds) * 100).toFixed(1)) : 0,
  })), [historyByDate, totalBeds]);

  if (beds.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhum leito cadastrado para {selectedUnit}.</p>
        <p className="text-sm text-muted-foreground mt-1">Cadastre leitos em Contratos antes de lançar movimentação.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unit filter for admin */}
      {isAdmin ? (
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Unidade</label>
          <Select value={selectedUnit} onValueChange={onUnitChange}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : (
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 w-fit">
          <p className="text-xs text-muted-foreground">Unidade</p>
          <p className="font-display font-semibold text-foreground text-sm">{profile?.facility_unit || selectedUnit}</p>
        </div>
      )}

      {/* Indicator cards — no icons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Taxa de Ocupação", value: `${occupancyRate}%`, color: "text-primary" },
          { label: "Giro de Leitos", value: turnover, color: "text-primary" },
          { label: "Saldo do Dia", value: String(dailyBalance), color: dailyBalance >= 0 ? "text-emerald-600" : "text-destructive" },
          { label: "Leitos Ocupados", value: `${totalOccupied}/${totalBeds}`, color: "text-primary" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="kpi-card p-4">
            <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
            <p className={cn("text-xl font-bold font-display", kpi.color)}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Date selector + save */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Data do lançamento</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] h-9 justify-start text-left font-normal")}>
                {format(movementDate, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={movementDate}
                onSelect={date => { if (date) setMovementDate(date); }}
                locale={ptBR}
                modifiers={{ hasData: (date) => daysWithData.has(format(date, "yyyy-MM-dd")) }}
                modifiersClassNames={{ hasData: "bg-primary/20 font-bold" }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <Button onClick={handleSave} disabled={saving} className="h-9">
          {saving ? "Salvando..." : "Salvar movimentação"}
        </Button>
      </div>

      {/* Movement form by category */}
      {Object.entries(groupedBeds).map(([category, categoryBeds]) => (
        <div key={category} className="kpi-card p-0 overflow-hidden">
          <div className="bg-primary/5 px-4 py-2 border-b border-border">
            <h3 className="font-display font-semibold text-sm text-foreground">{categoryLabel(category)}</h3>
            <p className="text-[10px] text-muted-foreground">{categoryBeds.reduce((s, b) => s + b.quantity, 0)} leitos cadastrados</p>
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Especialidade</TableHead>
                  <TableHead className="text-[10px]">Qtd</TableHead>
                  <TableHead className="text-[10px]">Ocupados</TableHead>
                  <TableHead className="text-[10px]">Internações</TableHead>
                  <TableHead className="text-[10px]">Altas</TableHead>
                  <TableHead className="text-[10px]">Óbitos</TableHead>
                  <TableHead className="text-[10px]">Transferências</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryBeds.map(bed => {
                  const key = `${bed.category}-${bed.specialty}`;
                  const form = forms[key] || { occupied: 0, admissions: 0, discharges: 0, deaths: 0, transfers: 0 };
                  return (
                    <TableRow key={key}>
                      <TableCell className="text-xs font-medium">{bed.specialty}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{bed.quantity}</TableCell>
                      {(["occupied", "admissions", "discharges", "deaths", "transfers"] as const).map(field => (
                        <TableCell key={field} className="p-1">
                          <Input type="number" min="0" value={form[field]} onChange={e => updateForm(key, field, e.target.value)} className="h-7 w-16 text-xs text-center" />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      {/* Charts — only show when there's history data */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Occupancy rate area chart */}
          <div className="kpi-card p-4">
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">Taxa de Ocupação (%)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradOcupacao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="ocupacao" stroke="hsl(var(--primary))" fill="url(#gradOcupacao)" name="Ocupação %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Admissions vs discharges bar chart */}
          <div className="kpi-card p-4">
            <h3 className="font-display font-semibold text-sm text-foreground mb-4">Internações vs Saídas</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="internacoes" fill="hsl(var(--primary))" name="Internações" radius={[4, 4, 0, 0]} />
                <Bar dataKey="altas" fill="hsl(142 71% 45%)" name="Altas" radius={[4, 4, 0, 0]} />
                <Bar dataKey="obitos" fill="hsl(var(--destructive))" name="Óbitos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* History table with inline edit */}
      {historyByDate.length > 0 && (
        <div className="kpi-card p-0 overflow-hidden">
          <div className="bg-primary/5 px-4 py-2 border-b border-border">
            <h3 className="font-display font-semibold text-sm text-foreground">Histórico de Movimentação</h3>
            <p className="text-[10px] text-muted-foreground">Clique em uma data para editar os valores</p>
          </div>
          <div className="overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Data</TableHead>
                  <TableHead className="text-[10px]">Ocupados</TableHead>
                  <TableHead className="text-[10px]">Internações</TableHead>
                  <TableHead className="text-[10px]">Altas</TableHead>
                  <TableHead className="text-[10px]">Óbitos</TableHead>
                  <TableHead className="text-[10px]">Transf.</TableHead>
                  <TableHead className="text-[10px]">Ocupação</TableHead>
                  <TableHead className="text-[10px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...historyByDate].reverse().map(row => {
                  const occRate = totalBeds > 0 ? ((row.occupied / totalBeds) * 100).toFixed(1) : "0";
                  const dateFormatted = format(new Date(row.date + "T00:00:00"), "dd/MM/yyyy");
                  const isEditing = editingDate === row.date;
                  const editRow = editingValues || { occupied: row.occupied, admissions: row.admissions, discharges: row.discharges, deaths: row.deaths, transfers: row.transfers };

                  if (isEditing) {
                    return (
                      <TableRow key={row.date} className="bg-primary/5">
                        <TableCell className="text-xs font-semibold text-primary">{dateFormatted}</TableCell>
                        {(["occupied", "admissions", "discharges", "deaths", "transfers"] as const).map(field => (
                          <TableCell key={field} className="p-1">
                            <Input
                              type="number"
                              min="0"
                              value={editRow[field]}
                              onChange={e => setEditingValues(prev => prev ? { ...prev, [field]: Math.max(0, parseInt(e.target.value) || 0) } : null)}
                              className="h-7 w-16 text-xs text-center"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-xs font-semibold">
                          {totalBeds > 0 ? ((editRow.occupied / totalBeds) * 100).toFixed(1) : "0"}%
                        </TableCell>
                        <TableCell className="p-1">
                          <div className="flex gap-1">
                            <Button size="sm" className="h-6 text-[10px] px-2" disabled={savingEdit} onClick={() => handleSaveEdit(row.date)}>
                              {savingEdit ? "..." : "Salvar"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => { setEditingDate(null); setEditingValues(null); }}>
                              Cancelar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <TableRow
                      key={row.date}
                      className="cursor-pointer hover:bg-primary/5"
                      onClick={() => {
                        setEditingDate(row.date);
                        setEditingValues({ occupied: row.occupied, admissions: row.admissions, discharges: row.discharges, deaths: row.deaths, transfers: row.transfers });
                      }}
                    >
                      <TableCell className="text-xs font-medium">{dateFormatted}</TableCell>
                      <TableCell className="text-xs">{row.occupied}</TableCell>
                      <TableCell className="text-xs">{row.admissions}</TableCell>
                      <TableCell className="text-xs">{row.discharges}</TableCell>
                      <TableCell className="text-xs">{row.deaths}</TableCell>
                      <TableCell className="text-xs">{row.transfers}</TableCell>
                      <TableCell className="text-xs font-semibold">{occRate}%</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">Editar</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BedMovementsTab;
