import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RiskItem {
  goal: string;
  risk: number;
  prob: number;
  trend: string;
  projected: string;
}

interface RiskModalProps {
  item: RiskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RiskModal = ({ item, open, onOpenChange }: RiskModalProps) => {
  if (!item) return null;

  const scenarios = [
    { label: "Otimista", prob: Math.max(5, item.prob - 25), risk: Math.round(item.risk * 0.4) },
    { label: "Base (atual)", prob: item.prob, risk: item.risk },
    { label: "Pessimista", prob: Math.min(99, item.prob + 15), risk: Math.round(item.risk * 1.4) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Risco — {item.goal}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Key risk metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">R$ em risco</p>
              <p className="font-display font-bold text-risk">R$ {(item.risk / 1000).toFixed(1)}k</p>
            </div>
            <div className="kpi-card !p-3">
              <p className="text-[10px] text-muted-foreground">Prob. de perda</p>
              <p className={`font-display font-bold ${item.prob >= 70 ? "text-risk" : "text-warning"}`}>{item.prob}%</p>
            </div>
          </div>

          {/* Projection */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Projeção atual</p>
            <p className="text-sm text-foreground">{item.projected}</p>
          </div>

          {/* Scenarios */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Cenários de risco (simulação)</p>
            <div className="space-y-2">
              {scenarios.map((s) => (
                <div key={s.label} className={`flex items-center justify-between p-3 rounded-lg border ${s.label === "Base (atual)" ? "border-primary/30 bg-accent/30" : "border-border"}`}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.label}</p>
                    <p className="text-xs text-muted-foreground">Prob. {s.prob}%</p>
                  </div>
                  <p className="font-display font-bold text-risk">R$ {(s.risk / 1000).toFixed(1)}k</p>
                </div>
              ))}
            </div>
          </div>

          {/* Formula explanation */}
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs font-medium text-foreground mb-1">Fórmula de cálculo</p>
            <p className="text-[11px] text-muted-foreground font-mono">
              Risco = Valor_variável × Peso_meta × (1 - Atingimento)
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Prioridade = R$ × P(não atingir) × Criticidade
            </p>
          </div>

          {/* Recommended action */}
          <div className="bg-warning/5 border border-warning/20 rounded-lg p-3">
            <p className="text-sm font-medium text-foreground">Ação sugerida</p>
            <p className="text-xs text-muted-foreground mt-1">
              Reforçar acompanhamento semanal e verificar evidências pendentes. 
              Convocar responsável para plano de recuperação imediato.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RiskModal;
