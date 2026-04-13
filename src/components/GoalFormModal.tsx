import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScoringRule, getDefaultScoringRules, getFixedScoringRules, normalizeScoringRules, findGlosaPct } from "@/lib/riskCalculation";

export interface GoalData {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  type: "QNT" | "QLT" | "DOC";
  risk: number;
  weight: number;
  trend: "up" | "down" | "stable";
  scoring: ScoringRule[];
  history: number[];
  facilityUnit?: string;
  sector?: string;
  startDate?: string;
  endDate?: string;
}

interface GoalFormModalProps {
  goal: GoalData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (goal: GoalData) => void;
  isNew?: boolean;
}

const TYPES = [
  { value: "QNT", label: "Quantitativa" },
  { value: "QLT", label: "Qualitativa" },
  { value: "DOC", label: "Documental" },
];

const UNITS = ["%", "min", "pts", "un", "doc", "dias", "taxa"];
const TRENDS = [
  { value: "up", label: "Em alta" },
  { value: "down", label: "Em queda" },
  { value: "stable", label: "Estável" },
];
const FACILITY_UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];

const GoalFormModal = ({ goal, open, onOpenChange, onSave, isNew = false }: GoalFormModalProps) => {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [unitVal, setUnitVal] = useState("%");
  const [type, setType] = useState<"QNT" | "QLT" | "DOC">("QNT");
  const [weight, setWeight] = useState("");
  const [trend, setTrend] = useState<"up" | "down" | "stable">("stable");
  const [facilityUnit, setFacilityUnit] = useState("Hospital Geral");
  const [sector, setSector] = useState("Todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Scoring rules
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>(getDefaultScoringRules());
  const [isProporcional, setIsProporcional] = useState(true);
  
  // Dynamic sectors from DB
  const [sectorOptions, setSectorOptions] = useState<string[]>([]);
  
  useEffect(() => {
    const loadSectors = async () => {
      const { data } = await supabase.from("sectors").select("name").eq("facility_unit", facilityUnit).order("name");
      setSectorOptions(["Todos", ...(data || []).map((s: any) => s.name)]);
    };
    loadSectors();
  }, [facilityUnit]);

  useEffect(() => {
    if (goal && !isNew) {
      setName(goal.name);
      setTarget(String(goal.target));
      setCurrent(String(goal.current));
      setUnitVal(goal.unit);
      setType(goal.type);
      setWeight(String(goal.weight * 100));
      setTrend(goal.trend);
      setFacilityUnit(goal.facilityUnit || "Hospital Geral");
      setSector(goal.sector || "Todos");
      setStartDate(goal.startDate || "");
      setEndDate(goal.endDate || "");
      const normalized = normalizeScoringRules(goal.scoring as any[]);
      setScoringRules(normalized);
      // Detect if it's proportional (more than 2 tiers)
      setIsProporcional(normalized.length > 2);
    } else if (isNew) {
      setName("");
      setTarget("");
      setCurrent("0");
      setUnitVal("%");
      setType("QNT");
      setWeight("10");
      setTrend("stable");
      setFacilityUnit("Hospital Geral");
      setSector("Todos");
      setStartDate("");
      setEndDate("");
      setScoringRules(getDefaultScoringRules());
      setIsProporcional(true);
    }
  }, [goal, isNew, open]);

  const handleProportionalToggle = (checked: boolean) => {
    setIsProporcional(checked);
    if (checked) {
      setScoringRules(getDefaultScoringRules());
    } else {
      setScoringRules(getFixedScoringRules());
    }
  };

  const updateScoringRule = (index: number, field: keyof ScoringRule, value: string | number) => {
    const updated = [...scoringRules];
    updated[index] = { ...updated[index], [field]: field === "label" ? value : Number(value) };
    setScoringRules(updated);
  };

  const addScoringRule = () => {
    setScoringRules([...scoringRules, { min: 0, label: "Nova faixa", glosa: 50 }]);
  };

  const removeScoringRule = (index: number) => {
    if (scoringRules.length <= 2) return;
    setScoringRules(scoringRules.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const targetNum = Number(target) || 0;
    const currentNum = Number(current) || 0;
    const weightNum = (Number(weight) || 10) / 100;

    // Calculate attainment
    const attainmentPct = type === "DOC"
      ? (currentNum >= targetNum ? 100 : 0)
      : targetNum > 0 ? Math.min(100, (currentNum / targetNum) * 100) : 0;

    // Calculate risk using scoring tiers (use a reference contract value for standalone display)
    const glosaPct = findGlosaPct(attainmentPct, scoringRules);
    const riskValue = glosaPct > 0 ? Math.round(weightNum * 1200000 * (glosaPct / 100)) : 0;

    const data: GoalData = {
      id: goal?.id || crypto.randomUUID(),
      name,
      target: targetNum,
      current: currentNum,
      unit: unitVal,
      type,
      risk: riskValue,
      weight: weightNum,
      trend,
      scoring: scoringRules,
      history: goal?.history || [0, 0, 0, 0],
      facilityUnit: facilityUnit,
      sector: sector === "Todos" ? undefined : sector,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    onSave(data);
    onOpenChange(false);
  };

  // Preview calculation
  const previewAttainment = (() => {
    const t = Number(target) || 0;
    const c = Number(current) || 0;
    if (t <= 0) return 0;
    if (type === "DOC") return c >= t ? 100 : 0;
    return Math.min(100, Math.round((c / t) * 100));
  })();
  const previewGlosa = findGlosaPct(previewAttainment, scoringRules);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isNew ? "Nova meta / indicador" : "Editar meta"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do indicador</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Taxa de ocupação de leitos" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Unidade hospitalar</Label>
              <Select value={facilityUnit} onValueChange={setFacilityUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FACILITY_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sectorOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "QNT" | "QLT" | "DOC")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={unitVal} onValueChange={setUnitVal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tendência</Label>
              <Select value={trend} onValueChange={(v) => setTrend(v as "up" | "down" | "stable")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRENDS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Meta (valor alvo)</Label>
              <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="85" />
            </div>
            <div className="space-y-2">
              <Label>Realizado atual</Label>
              <Input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="78" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Peso no contrato (%)</Label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="15" min="0" max="100" />
            </div>
            <div className="space-y-2">
              <Label>Início do período</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fim do período</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Scoring mode toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Faixas de glosa contratual</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{isProporcional ? "Proporcional" : "Único"}</span>
                <Switch checked={isProporcional} onCheckedChange={handleProportionalToggle} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {isProporcional
                ? "Glosa varia conforme faixa de atingimento — quanto mais próximo da meta, menor a penalidade."
                : "Glosa fixa: ou atinge 100% (sem penalidade) ou não atinge (penalidade total)."}
            </p>
            <div className="bg-secondary rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-[10px] font-medium text-muted-foreground mb-1">
                <span>≥ % Atingimento</span>
                <span>Faixa</span>
                <span>% Glosa</span>
              </div>
              {scoringRules.map((rule, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-center">
                  <Input
                    type="number"
                    value={rule.min}
                    onChange={(e) => updateScoringRule(i, "min", e.target.value)}
                    placeholder="≥ %"
                    className="text-xs h-8"
                    min="0"
                    max="100"
                  />
                  <Input
                    value={rule.label}
                    onChange={(e) => updateScoringRule(i, "label", e.target.value)}
                    placeholder="Faixa"
                    className="text-xs h-8"
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={rule.glosa}
                      onChange={(e) => updateScoringRule(i, "glosa", e.target.value)}
                      placeholder="% glosa"
                      className="text-xs h-8"
                      min="0"
                      max="100"
                    />
                    {isProporcional && scoringRules.length > 2 && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeScoringRule(i)}>
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {isProporcional && (
                <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={addScoringRule}>
                  + Adicionar faixa
                </Button>
              )}
            </div>
          </div>

          {/* Preview */}
          {Number(target) > 0 && (
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-xs font-medium text-foreground mb-1">Pré-visualização</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Atingimento</p>
                  <p className="font-display font-bold text-foreground">{previewAttainment}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Peso</p>
                  <p className="font-display font-bold text-foreground">{weight}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Glosa aplicada</p>
                  <p className={`font-display font-bold ${previewGlosa > 0 ? "text-risk" : "text-success"}`}>
                    {previewGlosa}%
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave}>
              {isNew ? "Cadastrar meta" : "Salvar alterações"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GoalFormModal;
