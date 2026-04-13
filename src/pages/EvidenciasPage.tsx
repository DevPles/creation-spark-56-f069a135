import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import ActionPlanTable from "@/components/ActionPlanTable";
import ActionPlanTimeline from "@/components/ActionPlanTimeline";
import ActionPlanAnalytics from "@/components/ActionPlanAnalytics";
import ActionPlanReportTab from "@/components/ActionPlanReportTab";
import ActionPlanFormModal from "@/components/ActionPlanFormModal";

type ActionPlan = Tables<"action_plans">;

const ALL_UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];

const EvidenciasPage = () => {
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Determine which units the user can see
  const isManagerOrAdmin = role === "admin" || role === "gestor";
  const availableUnits = useMemo(() => {
    if (isManagerOrAdmin) return ALL_UNITS;
    // Regular users only see their own unit
    if (profile?.facility_unit) return [profile.facility_unit];
    return ALL_UNITS;
  }, [isManagerOrAdmin, profile?.facility_unit]);

  const unitOptions = useMemo(() => {
    if (availableUnits.length > 1) return ["Todas as unidades", ...availableUnits];
    return availableUnits;
  }, [availableUnits]);

  // Set default unit for non-managers
  useEffect(() => {
    if (!isManagerOrAdmin && profile?.facility_unit) {
      setSelectedUnit(profile.facility_unit);
    }
  }, [isManagerOrAdmin, profile?.facility_unit]);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("action_plans")
      .select("*")
      .order("created_at", { ascending: false });

    // Non-managers only see plans from their unit
    if (!isManagerOrAdmin && profile?.facility_unit) {
      query = query.eq("facility_unit", profile.facility_unit);
    }

    const { data, error } = await query;
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar planos de ação");
    }
    setPlans((data as ActionPlan[]) || []);
    setLoading(false);
  }, [isManagerOrAdmin, profile?.facility_unit]);

  useEffect(() => {
    fetchPlans();
    const channel = supabase
      .channel("action_plans_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "action_plans" }, () => {
        fetchPlans();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPlans]);

  const filteredPlans = useMemo(() => {
    if (selectedUnit === "Todas as unidades") return plans;
    return plans.filter(p => p.facility_unit === selectedUnit);
  }, [plans, selectedUnit]);

  const handleNew = () => {
    setSelectedPlan(null);
    setIsNew(true);
    setModalOpen(true);
  };

  const handleSelect = (plan: ActionPlan) => {
    setSelectedPlan(plan);
    setIsNew(false);
    setModalOpen(true);
  };

  const handleSaved = () => { fetchPlans(); };

  // KPIs
  const total = filteredPlans.length;
  const naoIniciadas = filteredPlans.filter(p => p.status_acao === "nao_iniciada").length;
  const emAndamento = filteredPlans.filter(p => p.status_acao === "em_andamento").length;
  const concluidas = filteredPlans.filter(p => p.status_acao === "concluida").length;
  const today = new Date();
  const vencidas = filteredPlans.filter(p =>
    p.prazo && new Date(p.prazo + "T00:00:00") < today &&
    p.status_acao !== "concluida" && p.status_acao !== "cancelada"
  ).length;

  const kpis = [
    { label: "Total", value: total, color: "text-foreground" },
    { label: "Não iniciadas", value: naoIniciadas, color: "text-muted-foreground" },
    { label: "Em andamento", value: emAndamento, color: "text-warning" },
    { label: "Concluídas", value: concluidas, color: "text-success" },
    { label: "Vencidas", value: vencidas, color: "text-destructive" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full h-9 w-9 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold font-display text-foreground">Plano de Ação</h1>
              <p className="text-xs text-muted-foreground">Gestão de tratativas, evidências e acompanhamento de indicadores</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {unitOptions.length > 1 && (
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="w-48 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleNew} size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Novo plano
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {kpis.map(kpi => (
            <div key={kpi.label} className="kpi-card flex items-center gap-3 px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{kpi.label}</p>
                <p className={`text-lg font-bold font-display ${kpi.color}`}>{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tratativas" className="space-y-4">
          <TabsList className="grid w-full sm:w-auto sm:inline-grid grid-cols-4 gap-0">
            <TabsTrigger value="tratativas" className="text-xs">Tratativas</TabsTrigger>
            <TabsTrigger value="acompanhamento" className="text-xs">Acompanhamento</TabsTrigger>
            <TabsTrigger value="analise" className="text-xs">Análise</TabsTrigger>
            <TabsTrigger value="relatorios" className="text-xs">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="tratativas">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <ActionPlanTable plans={filteredPlans} onSelect={handleSelect} />
            )}
          </TabsContent>

          <TabsContent value="acompanhamento">
            <ActionPlanTimeline plans={plans} selectedUnit={selectedUnit} />
          </TabsContent>

          <TabsContent value="analise">
            <ActionPlanAnalytics plans={plans} selectedUnit={selectedUnit} />
          </TabsContent>

          <TabsContent value="relatorios">
            <ActionPlanReportTab plans={plans} selectedUnit={selectedUnit} />
          </TabsContent>
        </Tabs>
      </main>

      <ActionPlanFormModal
        plan={selectedPlan}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={handleSaved}
        isNew={isNew}
      />
    </div>
  );
};

export default EvidenciasPage;
