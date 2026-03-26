import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import GoalRow from "@/components/GoalRow";
import GoalModal from "@/components/GoalModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { toast } from "sonner";

const MOCK_GOALS = [
  { id: "1", name: "Taxa de ocupação de leitos", target: 85, current: 78, unit: "%", type: "QNT" as const, risk: 12400, trend: "down" as const },
  { id: "2", name: "Tempo médio de espera (emergência)", target: 30, current: 42, unit: "min", type: "QNT" as const, risk: 8200, trend: "up" as const },
  { id: "3", name: "Satisfação do paciente (NPS)", target: 75, current: 71, unit: "pts", type: "QNT" as const, risk: 5600, trend: "stable" as const },
  { id: "4", name: "Protocolo de higienização", target: 100, current: 92, unit: "%", type: "QLT" as const, risk: 3100, trend: "up" as const },
  { id: "5", name: "Relatório quadrimestral (RDQA)", target: 1, current: 0, unit: "doc", type: "DOC" as const, risk: 15000, trend: "down" as const },
  { id: "6", name: "Taxa de infecção hospitalar", target: 5, current: 6.2, unit: "%", type: "QNT" as const, risk: 9800, trend: "down" as const },
  { id: "7", name: "Cirurgias eletivas realizadas", target: 120, current: 98, unit: "un", type: "QNT" as const, risk: 7300, trend: "up" as const },
  { id: "8", name: "Comissão de óbitos ativa", target: 1, current: 1, unit: "doc", type: "QLT" as const, risk: 0, trend: "stable" as const },
];

const REPORT_TYPES = [
  { id: "consolidado", label: "Consolidado geral", description: "Resumo de todas as metas, atingimento e risco financeiro" },
  { id: "rdqa", label: "RDQA — Relatório Detalhado do Quadrimestre", description: "Exigido pela LC 141/2012, art. 36" },
  { id: "contrato", label: "Relatório por contrato", description: "Detalhamento financeiro e glosas por contrato" },
  { id: "metas", label: "Relatório de metas", description: "Evolução e projeções por indicador" },
  { id: "risco", label: "Análise de risco", description: "Cenários e priorização de recuperação" },
  { id: "evidencias", label: "Status de evidências", description: "Listagem de documentos enviados e pendentes" },
];

const GENERATED_REPORTS = [
  { id: "1", name: "Consolidado Q1 2024 — Hospital Geral", date: "15/04/2024", type: "consolidado", size: "1.2 MB" },
  { id: "2", name: "RDQA 1º Quadrimestre 2024", date: "30/04/2024", type: "rdqa", size: "3.4 MB" },
  { id: "3", name: "Risco financeiro — Mar 2024", date: "01/04/2024", type: "risco", size: "0.8 MB" },
];

const RelatoriosPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("4M");
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [selectedType, setSelectedType] = useState("consolidado");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [reports] = useState(GENERATED_REPORTS);

  const [selectedGoal, setSelectedGoal] = useState<typeof MOCK_GOALS[0] | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  const handleGenerate = () => {
    toast.success("Relatório sendo gerado...", { description: "O PDF será disponibilizado em instantes." });
  };

  const handleGoalClick = (goal: typeof MOCK_GOALS[0]) => {
    setSelectedGoal(goal);
    setGoalModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" /> Voltar ao painel
        </button>

        <PageHeader
          title="Relatórios"
          subtitle="Gerar PDF consolidado por período e visualizar metas"
          period={period} onPeriodChange={setPeriod}
          selectedUnit={selectedUnit} onUnitChange={setSelectedUnit}
        />

        {/* Goals Table (moved from Dashboard) */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg border border-border mb-8">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-display font-semibold text-foreground">Metas do período</h2>
            <p className="text-sm text-muted-foreground">{selectedUnit}</p>
          </div>
          <div className="divide-y divide-border">
            {MOCK_GOALS.map((goal, i) => (
              <GoalRow key={goal.id} goal={goal} index={i} onClick={() => handleGoalClick(goal)} />
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Generator */}
          <div className="lg:col-span-1">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="kpi-card space-y-4">
              <h2 className="font-display font-semibold text-foreground">Gerar novo relatório</h2>
              <div className="space-y-2">
                <Label>Tipo de relatório</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((t) => (<SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">{REPORT_TYPES.find((t) => t.id === selectedType)?.description}</p>
              </div>
              <div className="space-y-3">
                <Label>Opções</Label>
                <div className="flex items-center gap-2">
                  <Checkbox id="charts" checked={includeCharts} onCheckedChange={(c) => setIncludeCharts(!!c)} />
                  <label htmlFor="charts" className="text-sm text-foreground cursor-pointer">Incluir gráficos</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="details" checked={includeDetails} onCheckedChange={(c) => setIncludeDetails(!!c)} />
                  <label htmlFor="details" className="text-sm text-foreground cursor-pointer">Detalhamento por meta</label>
                </div>
              </div>
              <Button className="w-full" onClick={handleGenerate}>Gerar PDF</Button>
            </motion.div>
          </div>

          {/* History */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h2 className="font-display font-semibold text-foreground mb-3">Relatórios gerados</h2>
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="px-5 py-3 border-b border-border grid grid-cols-12 text-xs font-medium text-muted-foreground">
                  <span className="col-span-5">Nome</span><span className="col-span-2">Data</span><span className="col-span-2">Tipo</span><span className="col-span-1">Tamanho</span><span className="col-span-2 text-right">Ação</span>
                </div>
                {reports.map((report, i) => (
                  <motion.div key={report.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="px-5 py-3 grid grid-cols-12 items-center text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <span className="col-span-5 font-medium text-foreground">{report.name}</span>
                    <span className="col-span-2 text-muted-foreground">{report.date}</span>
                    <span className="col-span-2"><span className="status-badge bg-accent text-accent-foreground">{report.type}</span></span>
                    <span className="col-span-1 text-muted-foreground">{report.size}</span>
                    <span className="col-span-2 text-right"><Button variant="outline" size="sm">Baixar PDF</Button></span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <GoalModal goal={selectedGoal} open={goalModalOpen} onOpenChange={setGoalModalOpen} />
    </div>
  );
};

export default RelatoriosPage;
