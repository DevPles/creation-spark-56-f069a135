import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";

type ActionPlan = Tables<"action_plans">;
type HistoryEntry = Tables<"action_plan_history">;

interface Props {
  plans: ActionPlan[];
  selectedUnit: string;
}

const STATUS_LABELS: Record<string, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  nao_iniciada: "bg-muted",
  em_andamento: "bg-accent",
  concluida: "bg-primary",
  cancelada: "bg-destructive",
};

const ActionPlanTimeline = ({ plans, selectedUnit }: Props) => {
  const filtered = selectedUnit === "Todas as unidades" ? plans : plans.filter(p => p.facility_unit === selectedUnit);

  const grouped: Record<string, ActionPlan[]> = {
    nao_iniciada: [],
    em_andamento: [],
    concluida: [],
    cancelada: [],
  };

  filtered.forEach(p => {
    if (grouped[p.status_acao]) grouped[p.status_acao].push(p);
  });

  const today = new Date();

  const getPrazoStatus = (prazo: string | null) => {
    if (!prazo) return { label: "Sem prazo", className: "text-muted-foreground" };
    const d = new Date(prazo + "T00:00:00");
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `Vencido (${Math.abs(diff)}d)`, className: "text-destructive font-semibold" };
    if (diff <= 7) return { label: `${diff}d restantes`, className: "text-warning font-medium" };
    return { label: `${diff}d restantes`, className: "text-muted-foreground" };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {(["nao_iniciada", "em_andamento", "concluida", "cancelada"] as const).map(status => (
        <div key={status} className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status]}`} />
            <h3 className="text-sm font-semibold">{STATUS_LABELS[status]}</h3>
            <Badge variant="secondary" className="text-[10px]">{grouped[status].length}</Badge>
          </div>
          <div className="space-y-2">
            {grouped[status].length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhum item</p>
            )}
            {grouped[status].map(plan => {
              const prazo = getPrazoStatus(plan.prazo);
              return (
                <div key={plan.id} className="rounded-lg border border-border p-3 bg-card space-y-1.5 hover:shadow-sm transition-shadow">
                  <p className="text-sm font-medium text-foreground truncate">{plan.reference_name}</p>
                  {plan.responsavel && <p className="text-xs text-muted-foreground">{plan.responsavel}</p>}
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] ${prazo.className}`}>{prazo.label}</span>
                    <span className="text-[10px] text-muted-foreground">{plan.facility_unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActionPlanTimeline;
