import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  type: string;
  risk: number;
  trend: string;
}

interface GoalModalProps {
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GoalModal = ({ goal, open, onOpenChange }: GoalModalProps) => {
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

  const scoringRules = [
    { range: "≥ 100%", label: "Máximo", points: "1.0 pt" },
    { range: "90–99%", label: "Parcial alto", points: "0.75 pt" },
    { range: "70–89%", label: "Parcial baixo", points: "0.5 pt" },
    { range: "< 70%", label: "Insuficiente", points: "0 pt" },
  ];

  const history = [
    { period: "Jan", value: Math.round(goal.current * 0.85) },
    { period: "Fev", value: Math.round(goal.current * 0.9) },
    { period: "Mar", value: Math.round(goal.current * 0.95) },
    { period: "Abr", value: goal.current },
  ];

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
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-display font-semibold text-foreground">{goal.current}{goal.unit} / {goal.target}{goal.unit}</span>
            </div>
            <Progress value={attainment} className="h-2" />
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">Meta</p>
              <p className="font-display font-bold text-foreground">{goal.target}{goal.unit}</p>
            </div>
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">Realizado</p>
              <p className="font-display font-bold text-foreground">{goal.current}{goal.unit}</p>
            </div>
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">R$ em risco</p>
              <p className="font-display font-bold text-risk">
                {goal.risk > 0 ? `R$ ${(goal.risk / 1000).toFixed(1)}k` : "—"}
              </p>
            </div>
          </div>

          {/* History */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Evolução mensal</p>
            <div className="space-y-1.5">
              {history.map((h) => (
                <div key={h.period} className="flex items-center gap-3 text-sm">
                  <span className="w-8 text-muted-foreground">{h.period}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${status === "success" ? "bg-success" : status === "warning" ? "bg-warning" : "bg-risk"}`}
                      style={{ width: `${Math.min(100, (h.value / goal.target) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-display font-semibold w-12 text-right">{h.value}{goal.unit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scoring Rules */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Faixas de pontuação contratual</p>
            <div className="bg-secondary rounded-lg overflow-hidden">
              {scoringRules.map((rule, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${i > 0 ? "border-t border-border" : ""}`}>
                  <span className="text-foreground">{rule.range}</span>
                  <span className="text-muted-foreground">{rule.label}</span>
                  <span className="font-display font-semibold text-foreground">{rule.points}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Projection */}
          {goal.risk > 0 && (
            <div className="bg-risk/5 border border-risk/20 rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">Projeção de risco</p>
              <p className="text-xs text-muted-foreground mt-1">
                Com base no ritmo atual (run-rate), a projeção indica atingimento de {attainment}% ao fim do período,
                resultando em perda estimada de <span className="font-semibold text-risk">R$ {(goal.risk / 1000).toFixed(1)}k</span> na parte variável do contrato.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GoalModal;
