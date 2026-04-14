import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { ScoringRule, normalizeScoringRules, findGlosaPct } from "@/lib/riskCalculation";

interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  type: string;
  risk: number;
  trend: string;
  scoring?: ScoringRule[];
}

interface GoalModalProps {
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GoalModal = ({ goal, open, onOpenChange }: GoalModalProps) => {
  const { isAdmin } = useAuth();
  if (!goal) return null;

  const attainment = goal.type === "DOC"
    ? (goal.current >= goal.target ? 100 : 0)
    : Math.min(100, Math.round((goal.current / goal.target) * 100));

  const getStatus = () => {
    if (attainment >= 90) return "success";
    if (attainment >= 70) return "warning";
    return "critical";
  };
  const status = getStatus();

  const scoringRules = normalizeScoringRules(goal.scoring as any[] || []);
  const currentGlosa = findGlosaPct(attainment, scoringRules);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{goal.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Status + Attainment */}
          <div className="flex items-center gap-3">
            <span className={`status-badge ${status === "success" ? "status-success" : status === "warning" ? "status-warning" : "status-critical"}`}>
              {attainment}% atingido
            </span>
            <span className={`status-badge ${goal.type === "QNT" ? "bg-accent text-accent-foreground" : goal.type === "QLT" ? "status-success" : "status-warning"}`}>
              {goal.type}
            </span>
            <span className={`status-badge ${currentGlosa === 0 ? "status-success" : currentGlosa <= 25 ? "status-warning" : "status-critical"}`}>
              {currentGlosa}% glosa
            </span>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-display font-semibold text-foreground">{goal.current} {goal.unit} / {goal.target} {goal.unit}</span>
            </div>
            <Progress value={attainment} className="h-2" />
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">Meta</p>
              <p className="font-display font-bold text-foreground">{goal.target} {goal.unit}</p>
            </div>
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">Realizado</p>
              <p className="font-display font-bold text-foreground">{goal.current} {goal.unit}</p>
            </div>
            {isAdmin && (
              <div className="kpi-card !p-3">
                <p className="text-[10px] text-muted-foreground">R$ em risco</p>
                <p className="font-display font-bold text-risk">
                  {goal.risk > 0 ? `R$ ${(goal.risk / 1000).toFixed(1)}k` : "—"}
                </p>
              </div>
            )}
          </div>

          {/* Scoring Rules from DB */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Faixas de glosa contratual</p>
            <div className="bg-secondary rounded-lg overflow-hidden">
              {scoringRules.sort((a, b) => b.min - a.min).map((rule, i) => {
                const isActive = attainment >= rule.min && (i === 0 || attainment < scoringRules.sort((a, b) => b.min - a.min)[i - 1].min);
                return (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${i > 0 ? "border-t border-border" : ""} ${isActive ? "bg-primary/10" : ""}`}>
                    <span className="text-foreground">≥ {rule.min}%</span>
                    <span className="text-muted-foreground">{rule.label}</span>
                    <span className={`font-display font-semibold ${rule.glosa === 0 ? "text-success" : rule.glosa <= 25 ? "text-warning" : "text-risk"}`}>
                      {rule.glosa}% glosa
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Projection */}
          {isAdmin && goal.risk > 0 && (
            <div className="bg-risk/5 border border-risk/20 rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">Projeção de risco</p>
              <p className="text-xs text-muted-foreground mt-1">
                Com atingimento de {attainment}%, a glosa aplicada é de <span className="font-semibold text-risk">{currentGlosa}%</span> sobre o valor proporcional ao peso desta meta,
                resultando em perda estimada de <span className="font-semibold text-risk">R$ {(goal.risk / 1000).toFixed(1)}k</span>.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GoalModal;
