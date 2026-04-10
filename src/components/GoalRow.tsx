import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  type: "QNT" | "QLT" | "DOC";
  risk: number;
  trend: "up" | "down" | "stable";
}

const GoalRow = ({ goal, index, onClick }: { goal: Goal; index: number; onClick?: () => void }) => {
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
  const trendLabel = goal.trend === "up" ? "↑" : goal.trend === "down" ? "↓" : "→";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="px-5 py-3 grid grid-cols-12 items-center text-sm hover:bg-muted/30 transition-colors cursor-pointer"
    >
      <div className={isAdmin ? "col-span-4 sm:col-span-5" : "col-span-5 sm:col-span-6"}>
        <p className="font-medium text-foreground">{goal.name}</p>
        <span className={`status-badge mt-1 ${goal.type === "QNT" ? "bg-accent text-accent-foreground" : goal.type === "QLT" ? "status-success" : "status-warning"}`}>
          {goal.type}
        </span>
      </div>
      <div className="col-span-2 text-right">
        <p className="text-foreground">{goal.current}{goal.unit}</p>
        <p className="text-xs text-muted-foreground">meta: {goal.target}{goal.unit}</p>
      </div>
      <div className={isAdmin ? "col-span-2 text-center" : "col-span-3 text-center"}>
        <div className="inline-flex items-center gap-1">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${status === "success" ? "bg-success" : status === "warning" ? "bg-warning" : "bg-risk"}`}
              style={{ width: `${attainment}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{attainment}%</span>
        </div>
      </div>
      {isAdmin && (
        <div className="col-span-2 text-right">
          {goal.risk > 0 ? (
            <span className="font-display font-semibold text-risk">R$ {(goal.risk / 1000).toFixed(1)}k</span>
          ) : (
            <span className="text-success font-medium">Sem risco</span>
          )}
        </div>
      )}
      <div className="col-span-2 sm:col-span-1 text-right text-muted-foreground">
        {trendLabel}
      </div>
    </motion.div>
  );
};

export default GoalRow;
