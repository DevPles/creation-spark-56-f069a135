import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Rubrica } from "./types";

interface RubricaSectionProps {
  rubricas: Rubrica[];
  onChange: (rubricas: Rubrica[]) => void;
  totalValue: number;
}

const RubricaSection = ({ rubricas, onChange, totalValue }: RubricaSectionProps) => {
  const totalPercent = rubricas.reduce((sum, r) => sum + r.percent, 0);
  const remaining = 100 - totalPercent;

  const updateRubrica = (id: string, field: "name" | "percent", val: string) => {
    onChange(
      rubricas.map((r) =>
        r.id === id
          ? { ...r, [field]: field === "percent" ? Math.min(100, Math.max(0, Number(val) || 0)) : val }
          : r
      )
    );
  };

  const addRubrica = () => {
    onChange([...rubricas, { id: crypto.randomUUID(), name: "", percent: 0 }]);
  };

  const removeRubrica = (id: string) => {
    onChange(rubricas.filter((r) => r.id !== id));
  };

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `R$ ${(val / 1_000).toFixed(0)}k`;
    return `R$ ${val.toFixed(0)}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Distribuição por rubricas</Label>
        <span className={`text-xs font-medium ${totalPercent > 100 ? "text-destructive" : totalPercent === 100 ? "text-emerald-600" : "text-muted-foreground"}`}>
          {totalPercent}% alocado — {remaining >= 0 ? `${remaining}% restante` : `${Math.abs(remaining)}% excedente`}
        </span>
      </div>

      <Progress value={Math.min(totalPercent, 100)} className="h-2" />

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {rubricas.map((r) => {
          const rubricaValue = totalValue * (r.percent / 100);
          return (
            <div key={r.id} className="flex items-center gap-2">
              <Input
                value={r.name}
                onChange={(e) => updateRubrica(r.id, "name", e.target.value)}
                placeholder="Nome da rubrica"
                className="flex-1 h-9 text-sm"
              />
              <div className="flex items-center gap-1 w-24">
                <Input
                  type="number"
                  value={r.percent || ""}
                  onChange={(e) => updateRubrica(r.id, "percent", e.target.value)}
                  placeholder="0"
                  min="0"
                  max="100"
                  className="h-9 text-sm text-center w-16"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <span className="text-xs text-muted-foreground w-20 text-right truncate">
                {totalValue > 0 && r.percent > 0 ? formatCurrency(rubricaValue) : "—"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeRubrica(r.id)}
              >
                ✕
              </Button>
            </div>
          );
        })}
      </div>

      <Button variant="outline" size="sm" onClick={addRubrica} className="w-full">
        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar rubrica
      </Button>

      {/* Summary by type */}
      {totalValue > 0 && rubricas.some((r) => r.percent > 0) && (
        <div className="bg-secondary rounded-lg p-3 space-y-1">
          <p className="text-xs font-medium text-foreground mb-2">Peso por rubrica</p>
          {rubricas
            .filter((r) => r.percent > 0)
            .map((r) => (
              <div key={r.id} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{r.name || "Sem nome"}</span>
                <span className="font-medium text-foreground">
                  {r.percent}% — {formatCurrency(totalValue * (r.percent / 100))}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default RubricaSection;
