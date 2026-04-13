import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeScoringRules, findGlosaPct, ScoringRule } from "@/lib/riskCalculation";

interface Contract {
  id: string;
  name: string;
  value: number;
  variable: number;
  goals: number;
  status: string;
  period: string;
  unit?: string;
  pdfName?: string;
  pdfUrl?: string;
}

interface ContractModalProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GoalRow {
  name: string;
  weight: number;
  attainment: number;
  scoring: ScoringRule[];
}

const ContractModal = ({ contract, open, onOpenChange }: ContractModalProps) => {
  const [goalRows, setGoalRows] = useState<GoalRow[]>([]);

  useEffect(() => {
    if (!contract || !open) return;
    const fetchGoals = async () => {
      const unit = contract.unit || "";
      const { data: goalsData } = await supabase
        .from("goals")
        .select("id, name, target, type, weight, scoring")
        .eq("facility_unit", unit as any);

      const { data: entriesData } = await supabase
        .from("goal_entries")
        .select("goal_id, value");

      const entriesByGoal: Record<string, number> = {};
      (entriesData || []).forEach(e => {
        entriesByGoal[e.goal_id] = (entriesByGoal[e.goal_id] || 0) + Number(e.value);
      });

      setGoalRows((goalsData || []).map(g => {
        const current = entriesByGoal[g.id] || 0;
        const target = Number(g.target);
        const attainment = g.type === "DOC"
          ? (current >= target ? 100 : 0)
          : target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
        const scoring = normalizeScoringRules((g.scoring as any[]) || []);
        return { name: g.name, weight: Number(g.weight), attainment, scoring };
      }));
    };
    fetchGoals();
  }, [contract, open]);

  if (!contract) return null;

  const variableAmount = contract.value * contract.variable;
  const totalRisk = goalRows.reduce((sum, g) => {
    const goalVar = variableAmount * g.weight;
    const glosaPct = findGlosaPct(g.attainment, g.scoring);
    return sum + (glosaPct > 0 ? goalVar * (glosaPct / 100) : 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{contract.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <span className={`status-badge ${contract.status === "Vigente" ? "status-success" : "status-warning"}`}>
              {contract.status}
            </span>
            <span className="text-sm text-muted-foreground">Vigência: {contract.period}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">Valor total</p>
              <p className="font-display font-bold text-foreground">R$ {(contract.value / 1000000).toFixed(1)}M</p>
            </div>
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">Parte variável</p>
              <p className="font-display font-bold text-foreground">{(contract.variable * 100).toFixed(0)}%</p>
            </div>
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">R$ variável</p>
              <p className="font-display font-bold text-foreground">R$ {(variableAmount / 1000).toFixed(0)}k</p>
            </div>
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">R$ em risco</p>
              <p className="font-display font-bold text-risk">R$ {(totalRisk / 1000).toFixed(1)}k</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Metas vinculadas e glosas</p>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-medium text-muted-foreground border-b border-border">
                <span className="col-span-5">Meta</span>
                <span className="col-span-2 text-right">Peso</span>
                <span className="col-span-3 text-right">Atingimento</span>
                <span className="col-span-2 text-right">R$ risco</span>
              </div>
              {goalRows.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Nenhuma meta vinculada a esta unidade
                </div>
              ) : goalRows.map((goal, i) => {
                const goalVar = variableAmount * goal.weight;
                const glosaPct = findGlosaPct(goal.attainment, goal.scoring);
                const goalRisk = glosaPct > 0 ? goalVar * (glosaPct / 100) : 0;
                const statusClass = goal.attainment >= 90 ? "status-success" : goal.attainment >= 70 ? "status-warning" : "status-critical";

                return (
                  <div key={i} className="grid grid-cols-12 px-3 py-2.5 text-sm items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <span className="col-span-5 text-foreground text-xs">{goal.name}</span>
                    <span className="col-span-2 text-right text-muted-foreground text-xs">{(goal.weight * 100).toFixed(0)}%</span>
                    <span className="col-span-3 text-right">
                      <span className={`status-badge ${statusClass}`}>{goal.attainment}%</span>
                    </span>
                    <span className="col-span-2 text-right font-display font-semibold text-xs text-risk">
                      {goalRisk > 0 ? `R$ ${(goalRisk / 1000).toFixed(1)}k` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {contract.pdfUrl ? (
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">PDF do contrato</p>
              <p className="text-xs text-muted-foreground mt-1">{contract.pdfName || "Documento"}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => window.open(contract.pdfUrl, "_blank")}>
                Visualizar PDF
              </Button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Nenhum PDF anexado</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContractModal;
