import { Button } from "@/components/ui/button";
import GoalGauge from "./GoalGauge";
import { useAuth } from "@/contexts/AuthContext";
import { ScoringRule, findGlosaPct } from "@/lib/riskCalculation";

interface GoalDetail {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  type: string;
  risk: number;
  weight: number;
  scoring: ScoringRule[];
  history: number[];
  startDate?: string;
  endDate?: string;
  facilityUnit?: string;
}

const GoalDetailCard = ({ goal, onEdit }: { goal: GoalDetail; onEdit?: () => void }) => {
  const { isAdmin } = useAuth();
  const attainment = goal.type === "DOC"
    ? (goal.current >= goal.target ? 100 : 0)
    : Math.min(100, Math.round((goal.current / goal.target) * 100));

  const getStatus = () => {
    if (attainment >= 90) return "success";
    if (attainment >= 70) return "warning";
    return "critical";
  };
  const status = getStatus();
  const currentGlosa = findGlosaPct(attainment, goal.scoring);

  // Daily target calculation
  const remaining = Math.max(0, goal.target - goal.current);
  const today = new Date();
  const endDate = goal.endDate ? new Date(goal.endDate) : null;
  const daysRemaining = endDate ? Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / 86400000)) : 0;
  const dailyGoal = daysRemaining > 0 ? remaining / daysRemaining : remaining;

  const maxHistory = Math.max(...goal.history, goal.target);

  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display font-semibold text-foreground text-sm">
            {goal.name}
            {goal.facilityUnit && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">— {goal.facilityUnit}</span>
            )}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`status-badge ${goal.type === "QNT" ? "bg-accent text-accent-foreground" : goal.type === "QLT" ? "status-success" : "status-warning"}`}>
              {goal.type}
            </span>
            <span className="text-xs text-muted-foreground">Peso: {(goal.weight * 100).toFixed(0)}%</span>
            <span className={`text-xs font-medium ${currentGlosa > 0 ? "text-risk" : "text-success"}`}>
              Glosa: {currentGlosa}%
            </span>
          </div>
        </div>
      </div>

      {/* Gauge */}
      <div className="mt-3">
        <GoalGauge percent={attainment} size={120} />
      </div>

      {/* Daily target info */}
      {goal.target > 0 && (
        <div className="bg-secondary/50 rounded-lg p-2.5 mt-2 text-center space-y-0.5">
          <p className="text-[10px] text-muted-foreground">
            Faltam <span className="font-semibold text-foreground">{remaining.toFixed(1)} {goal.unit}</span> para bater a meta
          </p>
          {endDate && daysRemaining > 0 ? (
            <p className="text-[10px] text-muted-foreground">
              Meta diária: <span className="font-semibold text-foreground">{dailyGoal.toFixed(2)}{goal.unit}/dia</span> ({daysRemaining} dias restantes)
            </p>
          ) : endDate && daysRemaining === 0 ? (
            <p className="text-[10px] text-destructive font-medium">Prazo encerrado</p>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">Sem período definido</p>
          )}
        </div>
      )}

      {/* Mini bar chart */}
      <div className="flex items-end gap-1 h-12 mt-4">
        {goal.history.map((val, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div
              className={`w-full rounded-sm transition-all ${status === "success" ? "bg-success/60" : status === "warning" ? "bg-warning/60" : "bg-risk/60"}`}
              style={{ height: `${(val / maxHistory) * 100}%` }}
            />
          </div>
        ))}
        <div className="flex-1 flex flex-col items-center">
          <div
            className="w-full rounded-sm bg-primary/80"
            style={{ height: `${(goal.current / maxHistory) * 100}%` }}
          />
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span><span>Atual</span>
      </div>

      {/* Values */}
      <div className={`grid ${isAdmin ? "grid-cols-3" : "grid-cols-2"} gap-3 mt-4 pt-3 border-t border-border`}>
        <div>
          <p className="text-[10px] text-muted-foreground">Realizado</p>
          <p className="font-display font-bold text-foreground text-sm">{goal.current}{goal.unit}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Meta</p>
          <p className="font-display font-bold text-foreground text-sm">{goal.target}{goal.unit}</p>
        </div>
        {isAdmin && (
          <div>
            <p className="text-[10px] text-muted-foreground">R$ em risco</p>
            <p className="font-display font-bold text-risk text-sm">
              {goal.risk > 0 ? `R$ ${(goal.risk / 1000).toFixed(1)}k` : "—"}
            </p>
          </div>
        )}
      </div>

      {/* Scoring rules */}
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground mb-1.5">Faixas de glosa</p>
        <div className="flex flex-wrap gap-1">
          {goal.scoring.map((s, i) => (
            <span key={i} className={`text-[10px] rounded px-1.5 py-0.5 ${
              s.glosa === 0 ? "bg-success/20 text-success" : 
              s.glosa <= 25 ? "bg-warning/20 text-warning" : 
              "bg-risk/20 text-risk"
            }`}>
              ≥{s.min}% → {s.glosa}% glosa
            </span>
          ))}
        </div>
      </div>

      {onEdit && (
        <div className="flex justify-end mt-3 pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            Editar
          </Button>
        </div>
      )}
    </div>
  );
};

export default GoalDetailCard;
