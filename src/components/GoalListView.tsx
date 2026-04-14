import { GoalData } from "@/components/GoalFormModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { differenceInDays, parseISO, startOfDay } from "date-fns";

interface GoalListViewProps {
  goals: GoalData[];
  onView: (goal: GoalData) => void;
  onEdit: (goal: GoalData) => void;
}

const GoalListView = ({ goals, onView, onEdit }: GoalListViewProps) => {
  const today = startOfDay(new Date());

  const compute = (goal: GoalData) => {
    const start = goal.startDate ? startOfDay(parseISO(goal.startDate)) : null;
    const end = goal.endDate ? startOfDay(parseISO(goal.endDate)) : null;

    if (!start || !end) {
      return { dailyTarget: 0, expectedAccum: 0, deficit: 0, daysRemaining: 0, daysTotal: 0, pct: goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0 };
    }

    const daysTotal = Math.max(differenceInDays(end, start), 1);
    const daysElapsed = Math.max(0, Math.min(differenceInDays(today, start), daysTotal));
    const daysRemaining = Math.max(0, differenceInDays(end, today));
    const dailyTarget = goal.target / daysTotal;
    const expectedAccum = dailyTarget * daysElapsed;
    const deficit = expectedAccum - goal.current;
    const pct = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;

    return { dailyTarget, expectedAccum, deficit, daysRemaining, daysTotal, pct };
  };

  const statusColor = (pct: number, deficit: number) => {
    if (pct >= 90) return "text-green-600";
    if (deficit <= 0) return "text-green-600";
    if (pct >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const progressColor = (pct: number, deficit: number) => {
    if (pct >= 90 || deficit <= 0) return "bg-green-500";
    if (pct >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return (
    <div className="rounded-lg border bg-card overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Meta</TableHead>
            <TableHead className="text-center w-[60px]">Tipo</TableHead>
            <TableHead className="text-right w-[100px]">Realizado</TableHead>
            <TableHead className="text-right w-[100px]">Meta Total</TableHead>
            <TableHead className="text-right w-[100px]">Meta Diária</TableHead>
            <TableHead className="text-right w-[120px]">Acum. Esperado</TableHead>
            <TableHead className="text-right w-[100px]">Déficit</TableHead>
            <TableHead className="w-[140px]">Progresso</TableHead>
            <TableHead className="text-center w-[80px]">Dias Rest.</TableHead>
            <TableHead className="w-[40px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {goals.map((goal) => {
            const { dailyTarget, expectedAccum, deficit, daysRemaining, pct } = compute(goal);
            return (
              <TableRow
                key={goal.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onView(goal)}
              >
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span className="truncate max-w-[220px]">{goal.name}</span>
                    {goal.facilityUnit && (
                      <span className="text-xs text-muted-foreground">{goal.facilityUnit}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs">{goal.type}</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {fmt(goal.current)} <span className="text-xs text-muted-foreground">{goal.unit}</span>
                </TableCell>
                <TableCell className="text-right">
                  {fmt(goal.target)} <span className="text-xs text-muted-foreground">{goal.unit}</span>
                </TableCell>
                <TableCell className="text-right">
                  {fmt(dailyTarget)}
                </TableCell>
                <TableCell className="text-right">
                  {fmt(expectedAccum)}
                </TableCell>
                <TableCell className={`text-right font-semibold ${deficit > 0 ? "text-red-600" : "text-green-600"}`}>
                  {deficit > 0 ? `-${fmt(deficit)}` : `+${fmt(Math.abs(deficit))}`}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progressColor(pct, deficit)}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold min-w-[36px] text-right ${statusColor(pct, deficit)}`}>
                      {fmt(pct)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm font-medium">{daysRemaining}</span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); onEdit(goal); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default GoalListView;
