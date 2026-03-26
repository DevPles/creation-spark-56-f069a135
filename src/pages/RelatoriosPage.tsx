import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { toast } from "sonner";

const PERIODS = [
  { key: "S", label: "Semana" },
  { key: "M", label: "Mês" },
  { key: "Q", label: "Trimestre" },
  { key: "4M", label: "Quadrimestre" },
  { key: "Y", label: "Anual" },
];
const UNITS = ["Todas as unidades", "Hospital Geral", "UPA Norte", "UBS Centro"];

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
  const [selectedUnit, setSelectedUnit] = useState(UNITS[0]);
  const [selectedType, setSelectedType] = useState("consolidado");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [reports] = useState(GENERATED_REPORTS);

  const handleGenerate = () => {
    toast.success("Relatório sendo gerado...", {
      description: "O PDF será disponibilizado em instantes.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar periods={PERIODS} activePeriod={period} onPeriodChange={setPeriod} units={UNITS} selectedUnit={selectedUnit} onUnitChange={setSelectedUnit} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" /> Voltar ao painel
        </button>

        <h1 className="font-display text-xl font-bold text-foreground mb-1">Relatórios</h1>
        <p className="text-sm text-muted-foreground mb-6">Gerar PDF consolidado por período</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Generator */}
          <div className="lg:col-span-1">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="kpi-card space-y-4">
              <h2 className="font-display font-semibold text-foreground">Gerar novo relatório</h2>

              <div className="space-y-2">
                <Label>Tipo de relatório</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {REPORT_TYPES.find((t) => t.id === selectedType)?.description}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              <div className="bg-secondary rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground">
                  O relatório incluirá: cabeçalho corporativo, data/hora de emissão, identificação do emissor, versão do contrato e paginação. Gerado server-side para consistência visual.
                </p>
              </div>
            </motion.div>
          </div>

          {/* History */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h2 className="font-display font-semibold text-foreground mb-3">Relatórios gerados</h2>
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="px-5 py-3 border-b border-border grid grid-cols-12 text-xs font-medium text-muted-foreground">
                  <span className="col-span-5">Nome</span>
                  <span className="col-span-2">Data</span>
                  <span className="col-span-2">Tipo</span>
                  <span className="col-span-1">Tamanho</span>
                  <span className="col-span-2 text-right">Ação</span>
                </div>
                {reports.map((report, i) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="px-5 py-3 grid grid-cols-12 items-center text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <span className="col-span-5 font-medium text-foreground">{report.name}</span>
                    <span className="col-span-2 text-muted-foreground">{report.date}</span>
                    <span className="col-span-2">
                      <span className="status-badge bg-accent text-accent-foreground">{report.type}</span>
                    </span>
                    <span className="col-span-1 text-muted-foreground">{report.size}</span>
                    <span className="col-span-2 text-right">
                      <Button variant="outline" size="sm">Baixar PDF</Button>
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RelatoriosPage;
