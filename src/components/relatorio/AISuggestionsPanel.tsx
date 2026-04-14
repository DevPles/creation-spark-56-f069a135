import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Suggestion {
  title: string;
  text: string;
}

interface Props {
  sectionTitle: string;
  goalSummary: any;
  actionPlanSummary: any;
  sauSummary: any;
  bedSummary: any;
  rubricaSummary: any;
  unit: string;
  period: string;
  onInsert: (text: string) => void;
  editable: boolean;
}

const AISuggestionsPanel = ({
  sectionTitle, goalSummary, actionPlanSummary, sauSummary,
  bedSummary, rubricaSummary, unit, period, onInsert, editable,
}: Props) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastDataHash = useRef("");

  const dataHash = JSON.stringify([goalSummary?.avg, goalSummary?.total, actionPlanSummary?.total, sauSummary?.total, bedSummary?.total, rubricaSummary?.totalExecuted]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("report-suggestions", {
        body: { sectionTitle, goalSummary, actionPlanSummary, sauSummary, bedSummary, rubricaSummary, unit, period },
      });
      if (error) throw error;
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
        lastDataHash.current = dataHash;
      }
    } catch (err: any) {
      console.error("Erro ao gerar sugestões:", err);
      toast.error("Erro ao gerar sugestões de IA");
    } finally {
      setLoading(false);
    }
  };

  if (!editable || dismissed) return null;

  const CATEGORY_COLORS: Record<number, string> = {
    0: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30",
    1: "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30",
    2: "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30",
  };

  const CATEGORY_BADGES: Record<number, string> = {
    0: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    1: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    2: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground font-semibold">SUGESTÕES DE ANÁLISE INSTITUCIONAL (IA)</p>
        <div className="flex items-center gap-2">
          {suggestions.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-[9px] text-muted-foreground" onClick={() => setDismissed(true)}>
              Ocultar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={fetchSuggestions}
            disabled={loading}
          >
            {loading ? "Gerando..." : suggestions.length > 0 ? "Regerar sugestões" : "Gerar sugestões"}
          </Button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {suggestions.map((s, i) => (
            <div key={i} className={`rounded-lg border p-3 ${CATEGORY_COLORS[i] || ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${CATEGORY_BADGES[i] || ""}`}>
                    {s.title}
                  </span>
                  <p className="text-xs text-foreground mt-1.5 leading-relaxed">{s.text}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[9px] shrink-0"
                  onClick={() => {
                    onInsert(s.text);
                    toast.success("Sugestão inserida no campo de análise");
                  }}
                >
                  Inserir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AISuggestionsPanel;
