import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import GoalDetailCard from "@/components/GoalDetailCard";
import GoalModal from "@/components/GoalModal";
import GoalFormModal, { GoalData } from "@/components/GoalFormModal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { LayoutGrid, List, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import GoalListView from "@/components/GoalListView";
import GoalCalendarView from "@/components/GoalCalendarView";
import { toast } from "sonner";
import { normalizeScoringRules, findGlosaPct } from "@/lib/riskCalculation";

const MetasPage = () => {
  const navigate = useNavigate();
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [selectedType, setSelectedType] = useState("Todos");
  const [selectedGoalName, setSelectedGoalName] = useState("Todas");
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<GoalData | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<GoalData | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "list" | "calendar">("cards");

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    // Fetch goals
    const { data: goalsData, error: goalsError } = await supabase
      .from("goals")
      .select("*")
      .order("created_at", { ascending: true });

    if (goalsError) {
      console.error(goalsError);
      toast.error("Erro ao carregar metas");
      setLoading(false);
      return;
    }

    // Fetch all entries to compute current values and history
    const { data: entriesData } = await supabase
      .from("goal_entries")
      .select("goal_id, value, period")
      .order("created_at", { ascending: true });

    const entriesByGoal: Record<string, { value: number; period: string }[]> = {};
    (entriesData || []).forEach(e => {
      if (!entriesByGoal[e.goal_id]) entriesByGoal[e.goal_id] = [];
      entriesByGoal[e.goal_id].push({ value: Number(e.value), period: e.period });
    });

    const mapped: GoalData[] = (goalsData || []).map(g => {
      const gEntries = entriesByGoal[g.id] || [];
      const current = gEntries.reduce((sum, e) => sum + e.value, 0);
      const target = Number(g.target);
      const weight = Number(g.weight);
      const scoring = normalizeScoringRules((g.scoring as any[]) || []);

      // Compute trend from last 4 entries
      const lastValues = gEntries.slice(-4).map(e => e.value);
      let trend: "up" | "down" | "stable" = "stable";
      if (lastValues.length >= 2) {
        const last = lastValues[lastValues.length - 1];
        const prev = lastValues[lastValues.length - 2];
        if (last > prev) trend = "up";
        else if (last < prev) trend = "down";
      }

      // Build history (last 4 quarter-like buckets)
      const history = lastValues.length >= 4 ? lastValues.slice(-4) : [0, 0, 0, 0];

      // Risk calculation using scoring tiers
      const attainmentPct = g.type === "DOC"
        ? (current >= target ? 100 : 0)
        : target > 0 ? Math.min(100, (current / target) * 100) : 0;
      const glosaPct = findGlosaPct(attainmentPct, scoring);
      const risk = glosaPct > 0 ? Math.round(weight * 1200000 * (glosaPct / 100)) : 0;

      return {
        id: g.id,
        name: g.name,
        target,
        current,
        unit: g.unit,
        type: g.type as "QNT" | "QLT" | "DOC",
        risk,
        weight,
        trend,
        scoring,
        history,
        facilityUnit: g.facility_unit,
        sector: g.sector || undefined,
        startDate: g.start_date || undefined,
        endDate: g.end_date || undefined,
      };
    });

    setGoals(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleView = (goal: GoalData) => { setSelectedGoal(goal); setViewModalOpen(true); };
  const handleNew = () => { setEditGoal(null); setIsNew(true); setFormModalOpen(true); };
  const handleEdit = (goal: GoalData) => { setEditGoal(goal); setIsNew(false); setFormModalOpen(true); };

  const handleSave = async (goal: GoalData) => {
    if (isNew) {
      const { error } = await supabase.from("goals").insert({
        name: goal.name,
        target: goal.target,
        unit: goal.unit,
        type: goal.type,
        weight: goal.weight,
        risk: goal.risk,
        facility_unit: goal.facilityUnit as any || "Hospital Geral",
        scoring: goal.scoring as any,
        sector: goal.sector || null,
        start_date: goal.startDate || null,
        end_date: goal.endDate || null,
      });
      if (error) {
        console.error(error);
        toast.error("Erro ao criar meta");
        return;
      }
      toast.success("Meta criada com sucesso");
    } else {
      const { error } = await supabase.from("goals").update({
        name: goal.name,
        target: goal.target,
        unit: goal.unit,
        type: goal.type,
        weight: goal.weight,
        risk: goal.risk,
        facility_unit: goal.facilityUnit as any || "Hospital Geral",
        scoring: goal.scoring as any,
        sector: goal.sector || null,
        start_date: goal.startDate || null,
        end_date: goal.endDate || null,
      }).eq("id", goal.id);
      if (error) {
        console.error(error);
        toast.error("Erro ao atualizar meta");
        return;
      }
      toast.success("Meta atualizada");
    }
    fetchGoals();
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          Voltar
        </Button>

        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b">
          <PageHeader
            title="Metas e indicadores"
            subtitle="Clique para ver detalhes ou use o botão para cadastrar"
            selectedUnit={selectedUnit}
            onUnitChange={(v) => { setSelectedUnit(v); }}
            action={
              <div className="flex items-center gap-2">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos os tipos</SelectItem>
                    <SelectItem value="QNT">Quantitativa</SelectItem>
                    <SelectItem value="QLT">Qualitativa</SelectItem>
                    <SelectItem value="DOC">Documental</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleNew}>Nova meta</Button>
                <div className="flex items-center border rounded-md overflow-hidden">
                  <Button
                    variant={viewMode === "cards" ? "default" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-none"
                    onClick={() => setViewMode("cards")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-none"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "calendar" ? "default" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-none"
                    onClick={() => setViewMode("calendar")}
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            }
          />
        </div>

        <div className="pt-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando metas...</div>
          ) : goals
              .filter(g => selectedUnit === "Todas as unidades" || g.facilityUnit === selectedUnit)
              .filter(g => selectedType === "Todos" || g.type === selectedType)
              .length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma meta cadastrada{selectedUnit !== "Todas as unidades" ? ` para ${selectedUnit}` : ""}. Clique em "Nova meta" para começar.
            </div>
          ) : viewMode === "list" ? (
            <GoalListView
              goals={goals
                .filter((g) => selectedUnit === "Todas as unidades" || g.facilityUnit === selectedUnit)
                .filter((g) => selectedType === "Todos" || g.type === selectedType)}
              onView={handleView}
              onEdit={handleEdit}
            />
          ) : viewMode === "calendar" ? (
            <GoalCalendarView
              goals={goals
                .filter((g) => selectedUnit === "Todas as unidades" || g.facilityUnit === selectedUnit)
                .filter((g) => selectedType === "Todos" || g.type === selectedType)}
              onView={handleView}
              onEdit={handleEdit}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {goals
                .filter((g) => selectedUnit === "Todas as unidades" || g.facilityUnit === selectedUnit)
                .filter((g) => selectedType === "Todos" || g.type === selectedType)
                .map((goal, i) => (
                <motion.div key={goal.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="cursor-pointer" onClick={() => handleView(goal)}>
                    <GoalDetailCard goal={goal} onEdit={() => handleEdit(goal)} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedGoal && <GoalModal goal={{ ...selectedGoal, trend: selectedGoal.trend }} open={viewModalOpen} onOpenChange={setViewModalOpen} />}
      <GoalFormModal goal={editGoal} open={formModalOpen} onOpenChange={setFormModalOpen} onSave={handleSave} isNew={isNew} />
    </div>
  );
};

export default MetasPage;