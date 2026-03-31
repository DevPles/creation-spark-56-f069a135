import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Contract {
  id: string;
  name: string;
  value: number;
  variable: number;
  goals: number;
  status: string;
  period: string;
  pdfName?: string;
  pdfUrl?: string;
}

interface ContractModalProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MOCK_GOALS = [
  { name: "Taxa de ocupação de leitos", weight: 0.15, glosa: 5, attainment: 92 },
  { name: "Tempo médio de espera", weight: 0.10, glosa: 3, attainment: 71 },
  { name: "Satisfação do paciente (NPS)", weight: 0.10, glosa: 3, attainment: 95 },
  { name: "Protocolo de higienização", weight: 0.08, glosa: 2, attainment: 92 },
  { name: "Relatório quadrimestral (RDQA)", weight: 0.20, glosa: 8, attainment: 0 },
  { name: "Taxa de infecção hospitalar", weight: 0.12, glosa: 4, attainment: 81 },
  { name: "Cirurgias eletivas", weight: 0.10, glosa: 3, attainment: 82 },
  { name: "Comissão de óbitos ativa", weight: 0.05, glosa: 2, attainment: 100 },
];

const ContractModal = ({ contract, open, onOpenChange }: ContractModalProps) => {
  if (!contract) return null;

  const variableAmount = contract.value * contract.variable;
  const totalRisk = MOCK_GOALS.reduce((sum, g) => {
    const goalVar = variableAmount * g.weight;
    return sum + (g.attainment < 100 ? goalVar * (1 - g.attainment / 100) : 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{contract.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Contract info */}
          <div className="flex items-center gap-2">
            <span className={`status-badge ${contract.status === "Vigente" ? "status-success" : "status-warning"}`}>
              {contract.status}
            </span>
            <span className="text-sm text-muted-foreground">Vigência: {contract.period}</span>
          </div>

          {/* Financial summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">Valor total</p>
              <p className="font-display font-bold text-foreground">R$ {(contract.value / 1000000).toFixed(1)}M</p>
            </div>
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">Parte variável</p>
              <p className="font-display font-bold text-foreground">{(contract.variable * 100).toFixed(0)}%</p>
            </div>
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">R$ variável</p>
              <p className="font-display font-bold text-foreground">R$ {(variableAmount / 1000).toFixed(0)}k</p>
            </div>
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">R$ em risco</p>
              <p className="font-display font-bold text-risk">R$ {(totalRisk / 1000).toFixed(1)}k</p>
            </div>
          </div>

          {/* Goals table with glosa */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Metas vinculadas e glosas</p>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-medium text-muted-foreground border-b border-border">
                <span className="col-span-4">Meta</span>
                <span className="col-span-2 text-right">Peso</span>
                <span className="col-span-2 text-right">Glosa %</span>
                <span className="col-span-2 text-right">Atingimento</span>
                <span className="col-span-2 text-right">R$ risco</span>
              </div>
              {MOCK_GOALS.map((goal, i) => {
                const goalVar = variableAmount * goal.weight;
                const goalRisk = goal.attainment < 100 ? goalVar * (1 - goal.attainment / 100) : 0;
                const statusClass = goal.attainment >= 90 ? "status-success" : goal.attainment >= 70 ? "status-warning" : "status-critical";

                return (
                  <div key={i} className="grid grid-cols-12 px-3 py-2.5 text-sm items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <span className="col-span-4 text-foreground text-xs">{goal.name}</span>
                    <span className="col-span-2 text-right text-muted-foreground text-xs">{(goal.weight * 100).toFixed(0)}%</span>
                    <span className="col-span-2 text-right text-muted-foreground text-xs">{goal.glosa}%</span>
                    <span className="col-span-2 text-right">
                      <span className={`status-badge ${statusClass}`}>{goal.attainment}%</span>
                    </span>
                    <span className="col-span-2 text-right font-display font-semibold text-xs text-risk">
                      {goalRisk > 0 ? `R$ ${(goalRisk / 1000).toFixed(1)}k` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PDF upload area */}
          <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">PDF do contrato</p>
            <p className="text-xs text-muted-foreground mt-1">Contrato_Gestao_2024.pdf — 2.4 MB</p>
            <Button variant="outline" size="sm" className="mt-2">Visualizar PDF</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContractModal;
