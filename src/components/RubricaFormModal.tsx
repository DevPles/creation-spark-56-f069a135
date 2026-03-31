import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { ContractData, Rubrica } from "@/components/contract/types";


interface RubricaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ContractData;
  onSave: (contract: ContractData) => void;
}

const formatCurrency = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
};

const RubricaFormModal = ({ open, onOpenChange, contract, onSave }: RubricaFormModalProps) => {
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);

  useEffect(() => {
    if (open && contract) {
      setRubricas(contract.rubricas?.length ? contract.rubricas.map(r => ({ ...r })) : []);
    }
  }, [open, contract]);

  const totalPercent = rubricas.reduce((s, r) => s + r.percent, 0);
  const remaining = 100 - totalPercent;

  const updateRubrica = (id: string, field: "name" | "percent", val: string) => {
    setRubricas(prev => prev.map(r =>
      r.id === id ? { ...r, [field]: field === "percent" ? Math.min(100, Math.max(0, Number(val) || 0)) : val } : r
    ));
  };

  const addRubrica = () => {
    setRubricas(prev => [...prev, { id: crypto.randomUUID(), name: "", percent: 0 }]);
  };

  const removeRubrica = (id: string) => {
    setRubricas(prev => prev.filter(r => r.id !== id));
  };

  const handleSave = () => {
    onSave({ ...contract, rubricas: rubricas.filter(r => r.name && r.percent > 0) });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Gerenciar Rubricas</DialogTitle>
          <p className="text-sm text-muted-foreground">{contract?.name}</p>
          <p className="text-xs text-muted-foreground">Valor global: {formatCurrency(contract?.value || 0)}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${totalPercent > 100 ? "text-destructive" : totalPercent === 100 ? "text-emerald-600" : "text-muted-foreground"}`}>
              {totalPercent}% alocado — {remaining >= 0 ? `${remaining}% restante` : `${Math.abs(remaining)}% excedente`}
            </span>
          </div>
          <Progress value={Math.min(totalPercent, 100)} className="h-2" />

          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            {rubricas.map((r) => {
              const rubricaValue = (contract?.value || 0) * (r.percent / 100);
              return (
                <div key={r.id} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
                  <Input
                    value={r.name}
                    onChange={(e) => updateRubrica(r.id, "name", e.target.value)}
                    placeholder="Nome da rubrica"
                    className="flex-1 h-9 text-sm"
                  />
                  <div className="flex items-center gap-1 w-20">
                    <Input
                      type="number"
                      value={r.percent || ""}
                      onChange={(e) => updateRubrica(r.id, "percent", e.target.value)}
                      placeholder="0"
                      min="0"
                      max="100"
                      className="h-9 text-sm text-center w-14"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground w-16 text-right truncate">
                    {r.percent > 0 ? formatCurrency(rubricaValue) : "—"}
                  </span>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeRubrica(r.id)}>
                    ✕
                  </Button>
                </div>
              );
            })}
          </div>

          <Button variant="outline" size="sm" onClick={addRubrica} className="w-full">
            + Adicionar rubrica
          </Button>

          {rubricas.some(r => r.percent > 0 && r.name) && (
            <div className="bg-secondary rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-foreground mb-2">Resumo</p>
              {rubricas.filter(r => r.percent > 0 && r.name).map(r => (
                <div key={r.id} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{r.name}</span>
                  <span className="font-medium text-foreground">{r.percent}% — {formatCurrency((contract?.value || 0) * (r.percent / 100))}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave} disabled={totalPercent > 100}>
              Salvar rubricas
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RubricaFormModal;
