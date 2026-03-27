import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Goal {
  id: string;
  name: string;
  target: number;
  unit: string;
  type: string;
  weight: number;
  risk: number;
  facility_unit: string;
}

interface EntryForm {
  value: string;
  period: string;
  notes: string;
}

const PERIODS = [
  "Semana 1", "Semana 2", "Semana 3", "Semana 4",
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const LancamentoMetasPage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [entries, setEntries] = useState<Record<string, EntryForm>>({});
  const [existingEntries, setExistingEntries] = useState<Record<string, { value: number; period: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    loadGoals();
  }, [profile]);

  const loadGoals = async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("facility_unit", profile.facility_unit as any);

    if (error) {
      toast.error("Erro ao carregar metas");
      return;
    }
    setGoals((data as Goal[]) || []);

    // Load existing entries
    if (data && user) {
      const { data: entriesData } = await supabase
        .from("goal_entries")
        .select("*")
        .eq("user_id", user.id);

      const grouped: Record<string, { value: number; period: string }[]> = {};
      (entriesData || []).forEach((e: any) => {
        if (!grouped[e.goal_id]) grouped[e.goal_id] = [];
        grouped[e.goal_id].push({ value: e.value, period: e.period });
      });
      setExistingEntries(grouped);
    }

    setLoading(false);
  };

  const handleSubmit = async (goalId: string) => {
    if (!user) return;
    const entry = entries[goalId];
    if (!entry?.value || !entry?.period) {
      toast.error("Preencha o valor e o período");
      return;
    }

    setSubmitting(goalId);
    const { error } = await supabase.from("goal_entries").insert({
      goal_id: goalId,
      user_id: user.id,
      value: parseFloat(entry.value),
      period: entry.period,
      notes: entry.notes || null,
    });

    if (error) {
      toast.error("Erro ao salvar lançamento");
    } else {
      toast.success("Lançamento salvo com sucesso");
      setEntries((prev) => ({ ...prev, [goalId]: { value: "", period: "", notes: "" } }));
      loadGoals();
    }
    setSubmitting(null);
  };

  const updateEntry = (goalId: string, field: keyof EntryForm, value: string) => {
    setEntries((prev) => ({
      ...prev,
      [goalId]: { ...prev[goalId], [field]: value },
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          ← Voltar
        </Button>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Lançamento de metas</h1>
            <p className="text-sm text-muted-foreground">Lance os valores realizados das metas</p>
          </div>
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2">
            <p className="text-xs text-muted-foreground">Sua unidade</p>
            <p className="font-display font-semibold text-foreground text-sm">{profile?.facility_unit || "Carregando..."}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Carregando metas...</p>
        ) : goals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma meta cadastrada para sua unidade.</p>
            <p className="text-sm text-muted-foreground mt-1">Peça ao administrador para cadastrar as metas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {goals.map((goal, i) => {
              const entry = entries[goal.id] || { value: "", period: "", notes: "" };
              const existing = existingEntries[goal.id] || [];

              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="kpi-card"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-display font-semibold text-foreground text-sm">{goal.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Meta: {goal.target}{goal.unit} — Peso: {(goal.weight * 100).toFixed(0)}%
                      </p>
                    </div>
                    <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded">{goal.type}</span>
                  </div>

                  {existing.length > 0 && (
                    <div className="mb-3 p-2 bg-secondary/50 rounded">
                      <p className="text-[10px] text-muted-foreground mb-1">Lançamentos anteriores:</p>
                      <div className="flex flex-wrap gap-1">
                        {existing.map((e, idx) => (
                          <span key={idx} className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border">
                            {e.period}: {e.value}{goal.unit}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Valor realizado</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={`Ex: ${goal.target}`}
                          value={entry.value}
                          onChange={(e) => updateEntry(goal.id, "value", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Período</label>
                        <select
                          value={entry.period}
                          onChange={(e) => updateEntry(goal.id, "period", e.target.value)}
                          className="w-full h-8 text-sm border border-border rounded px-2 bg-background"
                        >
                          <option value="">Selecione</option>
                          {PERIODS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Observações (opcional)"
                      value={entry.notes}
                      onChange={(e) => updateEntry(goal.id, "notes", e.target.value)}
                      className="text-sm min-h-[40px]"
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={submitting === goal.id}
                      onClick={() => handleSubmit(goal.id)}
                    >
                      {submitting === goal.id ? "Salvando..." : "Lançar"}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default LancamentoMetasPage;
