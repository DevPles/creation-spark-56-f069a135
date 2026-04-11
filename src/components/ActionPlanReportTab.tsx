import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { FileText, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

type ActionPlan = Tables<"action_plans">;

interface Props {
  plans: ActionPlan[];
  selectedUnit: string;
}

const ActionPlanReportTab = ({ plans, selectedUnit }: Props) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [period, setPeriod] = useState("ultimo_trimestre");

  const generateReport = async () => {
    setLoading(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke("action-plan-report", {
        body: {
          facility_unit: selectedUnit === "Todas as unidades" ? null : selectedUnit,
          period,
        },
      });
      if (error) throw error;
      setReport(data?.report || "Nenhum relatório gerado.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar relatório. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = selectedUnit === "Todas as unidades" ? plans : plans.filter(p => p.facility_unit === selectedUnit);
  const total = filtered.length;
  const concluidas = filtered.filter(p => p.status_acao === "concluida").length;
  const pendentes = filtered.filter(p => p.status_evidencia === "pendente").length;
  const criticas = filtered.filter(p => p.prioridade === "critica" || p.prioridade === "alta").length;

  const stats = [
    { label: "Total de planos", value: total, icon: FileText, color: "text-foreground" },
    { label: "Concluídas", value: concluidas, icon: CheckCircle2, color: "text-success" },
    { label: "Evidências pendentes", value: pendentes, icon: Clock, color: "text-warning" },
    { label: "Alta / Crítica", value: criticas, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-5">
      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="kpi-card flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-background/60 ${stat.color}`}>
              <stat.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-lg font-bold font-display ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Generate report */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold font-display">Gerar Relatório Inteligente</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          O relatório analisa todos os planos de ação e identifica padrões de incidência, áreas críticas e gera recomendações priorizadas automaticamente.
        </p>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ultimo_mes">Último mês</SelectItem>
              <SelectItem value="ultimo_trimestre">Último trimestre</SelectItem>
              <SelectItem value="ultimo_semestre">Último semestre</SelectItem>
              <SelectItem value="todo">Todo o período</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={generateReport} disabled={loading || total === 0} size="sm" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            {loading ? "Gerando..." : "Gerar relatório"}
          </Button>
        </div>

        {report && (
          <div className="mt-4 bg-muted/20 rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold font-display">Relatório Consolidado</h4>
            </div>
            <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap text-xs leading-relaxed">
              {report}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionPlanReportTab;
