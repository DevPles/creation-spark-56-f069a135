import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";
import { Clock, AlertTriangle, CheckCircle2, XCircle, Hourglass } from "lucide-react";

type ActionPlan = Tables<"action_plans">;

interface Props {
  plans: ActionPlan[];
  selectedUnit: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; borderColor: string }> = {
  nao_iniciada: { label: "Não iniciadas", color: "text-muted-foreground", icon: Clock, borderColor: "border-muted-foreground/30" },
  em_andamento: { label: "Em andamento", color: "text-warning", icon: Hourglass, borderColor: "border-warning/30" },
  concluida: { label: "Concluídas", color: "text-success", icon: CheckCircle2, borderColor: "border-success/30" },
  cancelada: { label: "Canceladas", color: "text-destructive", icon: XCircle, borderColor: "border-destructive/30" },
};

const STATUSES = ["nao_iniciada", "em_andamento", "concluida", "cancelada"] as const;

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

  const getPrazoStatus = (prazo: string | null, status: string) => {
    if (status === "concluida" || status === "cancelada") return null;
    if (!prazo) return { label: "Sem prazo", className: "text-muted-foreground", urgent: false };
    const d = new Date(prazo + "T00:00:00");
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `Vencido há ${Math.abs(diff)}d`, className: "text-destructive font-semibold", urgent: true };
    if (diff <= 7) return { label: `${diff}d restantes`, className: "text-warning font-medium", urgent: true };
    return { label: `${diff}d restantes`, className: "text-muted-foreground", urgent: false };
  };

  if (filtered.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Nenhum plano de ação para acompanhamento.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {STATUSES.map(status => {
        const config = STATUS_CONFIG[status];
        const Icon = config.icon;
        const items = grouped[status];

        return (
          <div key={status} className="space-y-2">
            {/* Column header */}
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border ${config.borderColor}`}>
              <Icon className={`h-4 w-4 ${config.color}`} />
              <h3 className={`text-sm font-semibold ${config.color}`}>{config.label}</h3>
              <Badge variant="secondary" className="text-[10px] ml-auto">{items.length}</Badge>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground py-6 text-center bg-card/50 rounded-lg border border-dashed border-border">
                  Nenhum item
                </p>
              )}
              {items.map(plan => {
                const prazo = getPrazoStatus(plan.prazo, plan.status_acao);
                return (
                  <div key={plan.id} className={`rounded-xl border bg-card p-3 space-y-2 hover:shadow-md transition-shadow ${prazo?.urgent ? "border-destructive/30" : "border-border"}`}>
                    <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">{plan.reference_name}</p>
                    {plan.responsavel && (
                      <p className="text-[11px] text-muted-foreground">👤 {plan.responsavel}</p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      {prazo ? (
                        <span className={`text-[10px] flex items-center gap-1 ${prazo.className}`}>
                          {prazo.urgent && <AlertTriangle className="h-3 w-3" />}
                          {prazo.label}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="text-[10px] text-muted-foreground/70">{plan.facility_unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActionPlanTimeline;
