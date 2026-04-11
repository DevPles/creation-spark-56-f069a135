import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ActionPlanTable from "@/components/ActionPlanTable";
import ActionPlanTimeline from "@/components/ActionPlanTimeline";
import ActionPlanAnalytics from "@/components/ActionPlanAnalytics";
import ActionPlanReportTab from "@/components/ActionPlanReportTab";
import ActionPlanFormModal from "@/components/ActionPlanFormModal";

type ActionPlan = Tables<"action_plans">;

const EvidenciasPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("action_plans")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar planos de ação");
    }
    setPlans((data as ActionPlan[]) || []);
    setLoading(false);
  }, []);

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

  const handleSaved = () => {
    fetchPlans();
  };

  // KPIs
  const total = filteredPlans.length;
  const pendentes = filteredPlans.filter(p => p.status_acao === "nao_iniciada").length;
  const emAndamento = filteredPlans.filter(p => p.status_acao === "em_andamento").length;
  const concluidas = filteredPlans.filter(p => p.status_acao === "concluida").length;
  const today = new Date();
  const vencidas = filteredPlans.filter(p => p.prazo && new Date(p.prazo + "T00:00:00") < today && p.status_acao !== "concluida" && p.status_acao !== "cancelada").length;

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          Voltar
        </Button>

        <PageHeader
          title="Plano de Ação"
          subtitle="Gestão de tratativas, evidências e acompanhamento de indicadores"
          selectedUnit={selectedUnit}
          onUnitChange={setSelectedUnit}
          action={<Button onClick={handleNew}>Novo plano de ação</Button>}
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Total</p><p className="kpi-value">{total}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Não iniciadas</p><p className="kpi-value text-muted-foreground">{pendentes}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Em andamento</p><p className="kpi-value text-warning">{emAndamento}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Concluídas</p><p className="kpi-value text-success">{concluidas}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Vencidas</p><p className="kpi-value text-risk">{vencidas}</p></div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tratativas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tratativas">Tratativas</TabsTrigger>
            <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
            <TabsTrigger value="analise">Análise</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
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
