import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface HistoryEntry {
  id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
  notes: string | null;
}

interface Props {
  actionPlanId: string;
}

const FIELD_LABELS: Record<string, string> = {
  status_acao: "Status da ação",
  status_evidencia: "Status da evidência",
  prioridade: "Prioridade",
  responsavel: "Responsável",
  acao_corretiva: "Ação corretiva",
  causa_raiz: "Causa raiz",
  analise_critica: "Análise crítica",
  prazo: "Prazo",
  tipo_problema: "Tipo de problema",
  area: "Área",
  arquivo_url: "Arquivo",
  created: "Criação",
};

const ActionPlanHistoryTimeline = ({ actionPlanId }: Props) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("action_plan_history")
        .select("*")
        .eq("action_plan_id", actionPlanId)
        .order("changed_at", { ascending: false });
      setHistory((data as HistoryEntry[]) || []);
      setLoading(false);
    };
    if (actionPlanId) fetch();
  }, [actionPlanId]);

  if (loading) return <p className="text-xs text-muted-foreground py-2">Carregando histórico...</p>;
  if (history.length === 0) return <p className="text-xs text-muted-foreground py-2">Nenhuma alteração registrada</p>;

  return (
    <div className="space-y-2 max-h-40 overflow-y-auto">
      {history.map(entry => (
        <div key={entry.id} className="flex gap-2 text-[11px] border-l-2 border-primary/30 pl-3 py-1">
          <div className="flex-1">
            <span className="font-medium text-foreground">{FIELD_LABELS[entry.field_changed] || entry.field_changed}</span>
            {entry.old_value && (
              <span className="text-muted-foreground"> de "{entry.old_value}"</span>
            )}
            <span className="text-muted-foreground"> → </span>
            <span className="font-medium text-primary">{entry.new_value || "—"}</span>
            {entry.notes && <span className="text-muted-foreground block">Nota: {entry.notes}</span>}
          </div>
          <span className="text-muted-foreground shrink-0">
            {new Date(entry.changed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ActionPlanHistoryTimeline;
