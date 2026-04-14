import { useEffect, useState, useMemo } from "react";
import { GoalData } from "@/components/GoalFormModal";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { differenceInCalendarDays, format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GoalChartViewProps {
  goals: GoalData[];
  onView: (goal: GoalData) => void;
  onEdit: (goal: GoalData) => void;
}

interface EntryRow {
  goal_id: string;
  value: number;
  period: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

const GoalChartView = ({ goals, onView }: GoalChartViewProps) => {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const fetchEntries = async () => {
      const goalIds = goals.map((g) => g.id);
      if (goalIds.length === 0) return;
      const { data } = await supabase
        .from("goal_entries")
        .select("goal_id, value, period")
        .in("goal_id", goalIds)
        .order("period", { ascending: true });
      setEntries((data as EntryRow[]) || []);
    };
    fetchEntries();
  }, [goals]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group goals by sector
  const sectors = useMemo(() => {
    const map = new Map<string, GoalData[]>();
    goals.forEach((g) => {
      const sector = g.sector || "Outros";
      if (!map.has(sector)) map.set(sector, []);
      map.get(sector)!.push(g);
    });
    return map;
  }, [goals]);

  const sectorNames = useMemo(() => [...sectors.keys()].sort(), [sectors]);
  const [selectedSectorChart, setSelectedSectorChart] = useState("Todos");

  const visibleGoals = useMemo(() => {
    if (selectedSectorChart === "Todos") return goals;
    return sectors.get(selectedSectorChart) || [];
  }, [selectedSectorChart, goals, sectors]);

  // Build chart data: one row per day, one key per goal + trend line per goal
  const chartData = useMemo(() => {
    const entriesByGoalDay = new Map<string, number>();
    entries.forEach((e) => {
      // Convert period from dd/MM/yyyy to yyyy-MM-dd for matching
      let normalizedPeriod = e.period;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(e.period)) {
        const [dd, mm, yyyy] = e.period.split("/");
        normalizedPeriod = `${yyyy}-${mm}-${dd}`;
      }
      const key = `${e.goal_id}_${normalizedPeriod}`;
      entriesByGoalDay.set(key, (entriesByGoalDay.get(key) || 0) + e.value);
    });

    return daysInMonth.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayLabel = format(day, "dd");
      const row: Record<string, any> = { day: dayLabel, date: dayStr };

      visibleGoals.forEach((g) => {
        const val = entriesByGoalDay.get(`${g.id}_${dayStr}`) || 0;
        row[g.name] = val;

        // Daily target (trend line value)
        if (g.startDate && g.endDate) {
          const start = parseISO(g.startDate);
          const end = parseISO(g.endDate);
          const totalDays = differenceInCalendarDays(end, start) + 1;
          const dailyTarget = totalDays > 0 ? Math.round((g.target / totalDays) * 100) / 100 : 0;
          // Only show trend within goal period
          const dayDate = parseISO(dayStr);
          if (!isBefore(dayDate, start) && !isAfter(dayDate, end)) {
            row[`${g.name}_meta`] = dailyTarget;
          }
        }
      });

      return row;
    });
  }, [daysInMonth, entries, visibleGoals]);

  const prevMonth = () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={selectedSectorChart} onValueChange={setSelectedSectorChart}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos os setores</SelectItem>
              {sectorNames.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {visibleGoals.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma meta encontrada para o filtro selecionado.
        </div>
      ) : visibleGoals.length <= 5 ? (
        // Combined chart for up to 5 goals
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Produção diária vs Meta</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  labelFormatter={(label) => `Dia ${label}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {visibleGoals.map((g, i) => (
                  <Bar
                    key={g.id}
                    dataKey={g.name}
                    fill={COLORS[i % COLORS.length]}
                    opacity={0.7}
                    radius={[2, 2, 0, 0]}
                    name={g.name}
                  />
                ))}
                {visibleGoals.map((g, i) => (
                  <Line
                    key={`${g.id}_trend`}
                    dataKey={`${g.name}_meta`}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    name={`Meta diária - ${g.name}`}
                    connectNulls={false}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : (
        // Individual charts when too many goals
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleGoals.map((g, i) => {
            const goalChartData = chartData.map((row) => ({
              day: row.day,
              date: row.date,
              realizado: row[g.name] || 0,
              meta_diaria: row[`${g.name}_meta`],
            }));

            return (
              <Card
                key={g.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onView(g)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">{g.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {g.sector} · Meta: {g.target} {g.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{g.current}</p>
                    <p className="text-xs text-muted-foreground">realizado</p>
                  </div>
                </div>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={goalChartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ fontSize: 11 }}
                        labelFormatter={(label) => `Dia ${label}`}
                      />
                      <Bar
                        dataKey="realizado"
                        fill={COLORS[i % COLORS.length]}
                        opacity={0.7}
                        radius={[2, 2, 0, 0]}
                        name="Realizado"
                      />
                      <Line
                        dataKey="meta_diaria"
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        dot={false}
                        name="Meta diária"
                        connectNulls={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GoalChartView;
