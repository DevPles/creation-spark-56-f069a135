import { useEffect, useState, useMemo } from "react";
import { GoalData } from "@/components/GoalFormModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, getDaysInMonth, startOfDay, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface GoalCalendarViewProps {
  goals: GoalData[];
  onView: (goal: GoalData) => void;
  onEdit: (goal: GoalData) => void;
}

interface EntryRow {
  goal_id: string;
  value: number;
  period: string;
  created_at: string;
}

const GoalCalendarView = ({ goals, onView, onEdit }: GoalCalendarViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [entries, setEntries] = useState<EntryRow[]>([]);

  const daysInMonth = getDaysInMonth(new Date(currentMonth.year, currentMonth.month));
  const monthLabel = format(new Date(currentMonth.year, currentMonth.month), "MMMM yyyy", { locale: ptBR });

  useEffect(() => {
    const fetchEntries = async () => {
      const startDate = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-01`;
      const endMonth = currentMonth.month + 2 > 12
        ? `${currentMonth.year + 1}-01-01`
        : `${currentMonth.year}-${String(currentMonth.month + 2).padStart(2, "0")}-01`;

      const { data } = await supabase
        .from("goal_entries")
        .select("goal_id, value, period, created_at")
        .gte("created_at", startDate)
        .lt("created_at", endMonth)
        .order("created_at", { ascending: true });

      setEntries((data || []) as EntryRow[]);
    };
    fetchEntries();
  }, [currentMonth]);

  const entriesByGoalDay = useMemo(() => {
    const map: Record<string, Record<number, number>> = {};
    entries.forEach((e) => {
      // Use period (dd/MM/yyyy) to extract the day, not created_at
      let day: number;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(e.period)) {
        const [dd, mm, yyyy] = e.period.split("/");
        const periodDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        // Only include entries matching the current month view
        if (periodDate.getMonth() !== currentMonth.month || periodDate.getFullYear() !== currentMonth.year) return;
        day = Number(dd);
      } else {
        const periodDate = new Date(e.period);
        if (periodDate.getMonth() !== currentMonth.month || periodDate.getFullYear() !== currentMonth.year) return;
        day = periodDate.getDate();
      }
      if (!map[e.goal_id]) map[e.goal_id] = {};
      map[e.goal_id][day] = (map[e.goal_id][day] || 0) + Number(e.value);
    });
    return map;
  }, [entries, currentMonth]);

  const prevMonth = () => {
    setCurrentMonth((p) =>
      p.month === 0
        ? { year: p.year - 1, month: 11 }
        : { year: p.year, month: p.month - 1 }
    );
  };

  const nextMonth = () => {
    setCurrentMonth((p) =>
      p.month === 11
        ? { year: p.year + 1, month: 0 }
        : { year: p.year, month: p.month + 1 }
    );
  };

  const today = startOfDay(new Date());

  const computeGoalMetrics = (goal: GoalData) => {
    const start = goal.startDate ? startOfDay(parseISO(goal.startDate)) : null;
    const end = goal.endDate ? startOfDay(parseISO(goal.endDate)) : null;

    if (!start || !end) {
      const pct = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;
      return { dailyTarget: 0, expectedAccum: 0, deficit: 0, daysRemaining: 0, pct };
    }

    const daysTotal = Math.max(differenceInDays(end, start), 1);
    const daysElapsed = Math.max(0, Math.min(differenceInDays(today, start), daysTotal));
    const daysRemaining = Math.max(0, differenceInDays(end, today));
    const dailyTarget = goal.target / daysTotal;
    const expectedAccum = dailyTarget * daysElapsed;
    const deficit = expectedAccum - goal.current;
    const pct = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;

    return { dailyTarget, expectedAccum, deficit, daysRemaining, pct };
  };

  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  const progressColor = (pct: number, deficit: number) => {
    if (pct >= 90 || deficit <= 0) return "bg-green-500";
    if (pct >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const todayDay = today.getMonth() === currentMonth.month && today.getFullYear() === currentMonth.year
    ? today.getDate()
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold capitalize min-w-[140px] text-center">{monthLabel}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <ScrollArea className="w-full">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px] sticky left-0 bg-card z-20">Meta</TableHead>
                  <TableHead className="text-center w-[50px] sticky left-[180px] bg-card z-20">Tipo</TableHead>
                  {dayNumbers.map((d) => (
                    <TableHead
                      key={d}
                      className={`text-center w-[36px] px-1 text-xs ${d === todayDay ? "bg-primary/10 font-bold" : ""}`}
                    >
                      {d}
                    </TableHead>
                  ))}
                  <TableHead className="text-right w-[70px] px-2">Total Mês</TableHead>
                  <TableHead className="text-right w-[80px] px-2">Meta Total</TableHead>
                  <TableHead className="text-right w-[70px] px-2">M. Diária</TableHead>
                  <TableHead className="text-right w-[80px] px-2">Acum. Esp.</TableHead>
                  <TableHead className="text-right w-[70px] px-2">Déficit</TableHead>
                  <TableHead className="w-[100px] px-2">Progresso</TableHead>
                  <TableHead className="text-center w-[50px] px-1">Dias</TableHead>
                  <TableHead className="w-[36px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((goal) => {
                  const goalDays = entriesByGoalDay[goal.id] || {};
                  const monthTotal = Object.values(goalDays).reduce((s, v) => s + v, 0);
                  const { dailyTarget, expectedAccum, deficit, daysRemaining, pct } = computeGoalMetrics(goal);

                  return (
                    <TableRow
                      key={goal.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onView(goal)}
                    >
                      <TableCell className="font-medium sticky left-0 bg-card z-10">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[170px] text-xs">{goal.name}</span>
                          {goal.facilityUnit && (
                            <span className="text-[10px] text-muted-foreground">{goal.facilityUnit}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center sticky left-[180px] bg-card z-10">
                        <Badge variant="outline" className="text-[10px] px-1">{goal.type}</Badge>
                      </TableCell>
                      {dayNumbers.map((d) => {
                        const val = goalDays[d];
                        return (
                          <TableCell
                            key={d}
                            className={`text-center px-0.5 text-[11px] ${d === todayDay ? "bg-primary/5" : ""} ${val ? "font-medium" : "text-muted-foreground/30"}`}
                          >
                            {val ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`${val >= dailyTarget ? "text-green-600" : "text-red-600"}`}>
                                    {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : fmt(val)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <p>Dia {d}: {fmt(val)} {goal.unit}</p>
                                  <p className="text-muted-foreground">Meta diária: {fmt(dailyTarget)}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-[10px]">–</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right text-xs font-semibold px-2">
                        {fmt(monthTotal)}
                      </TableCell>
                      <TableCell className="text-right text-xs px-2">
                        {fmt(goal.target)}
                      </TableCell>
                      <TableCell className="text-right text-xs px-2">
                        {fmt(dailyTarget)}
                      </TableCell>
                      <TableCell className="text-right text-xs px-2">
                        {fmt(expectedAccum)}
                      </TableCell>
                      <TableCell className={`text-right text-xs font-semibold px-2 ${deficit > 0 ? "text-red-600" : "text-green-600"}`}>
                        {deficit > 0 ? `-${fmt(deficit)}` : `+${fmt(Math.abs(deficit))}`}
                      </TableCell>
                      <TableCell className="px-2">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 relative h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${progressColor(pct, deficit)}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold min-w-[28px] text-right">
                            {fmt(pct)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs px-1">
                        {daysRemaining}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); onEdit(goal); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
};

export default GoalCalendarView;
