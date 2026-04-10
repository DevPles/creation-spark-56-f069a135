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
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  scoring: { min: number; label: string; points: number }[];
  history: number[];
  glosaPct: number;
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
const SECTORS = [
  "Maternidade", "UTI Adulto", "UTI Neonatal", "Clínica Médica", "Clínica Cirúrgica",
  "Pediatria", "Pronto Socorro", "Centro Cirúrgico", "Ambulatório", "Farmácia",
  "Laboratório", "Radiologia", "Nutrição", "Fisioterapia", "Todos",
];

const DEFAULT_SCORING = [
  { min: 100, label: "Máximo", points: 1 },
  { min: 90, label: "Parcial alto", points: 0.75 },
  { min: 70, label: "Parcial baixo", points: 0.5 },
  { min: 0, label: "Insuficiente", points: 0 },
];

const GoalFormModal = ({ goal, open, onOpenChange, onSave, isNew = false }: GoalFormModalProps) => {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [unitVal, setUnitVal] = useState("%");
  const [type, setType] = useState<"QNT" | "QLT" | "DOC">("QNT");
  const [weight, setWeight] = useState("");
  const [trend, setTrend] = useState<"up" | "down" | "stable">("stable");
  const [glosaPct, setGlosaPct] = useState("");
  const [facilityUnit, setFacilityUnit] = useState("Hospital Geral");
  const [sector, setSector] = useState("Todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Scoring rules
  const [scoringRules, setScoringRules] = useState(DEFAULT_SCORING);

  useEffect(() => {
    if (goal && !isNew) {
      setName(goal.name);
      setTarget(String(goal.target));
      setCurrent(String(goal.current));
      setUnitVal(goal.unit);
      setType(goal.type);
      setWeight(String(goal.weight * 100));
      setTrend(goal.trend);
      setGlosaPct(String((goal.glosaPct || 0.05) * 100));
      setFacilityUnit(goal.facilityUnit || "Hospital Geral");
      setSector(goal.sector || "Todos");
      setStartDate(goal.startDate || "");
      setEndDate(goal.endDate || "");
      if (goal.scoring?.length) setScoringRules(goal.scoring);
    } else if (isNew) {
      setName("");
      setTarget("");
      setCurrent("0");
      setUnitVal("%");
      setType("QNT");
      setWeight("10");
      setTrend("stable");
      setGlosaPct("5");
      setFacilityUnit("Hospital Geral");
      setSector("Todos");
      setStartDate("");
      setEndDate("");
      setScoringRules(DEFAULT_SCORING);
    }
  }, [goal, isNew, open]);

  const updateScoringRule = (index: number, field: "min" | "label" | "points", value: string | number) => {
    const updated = [...scoringRules];
    updated[index] = { ...updated[index], [field]: field === "label" ? value : Number(value) };
    setScoringRules(updated);
  };

  const handleSave = () => {
    const targetNum = Number(target) || 0;
    const currentNum = Number(current) || 0;
    const weightNum = (Number(weight) || 10) / 100;
    const glosaPctNum = (Number(glosaPct) || 5) / 100;

    // Calculate risk based on attainment
    const attainment = type === "DOC"
      ? (currentNum >= targetNum ? 1 : 0)
      : Math.min(1, targetNum > 0 ? currentNum / targetNum : 0);
    const riskValue = attainment < 1 ? Math.round((1 - attainment) * weightNum * 1200000 * glosaPctNum) : 0;

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
      glosaPct: glosaPctNum,
      facilityUnit: facilityUnit,
      sector: sector === "Todos" ? undefined : sector,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    onSave(data);
    onOpenChange(false);
  };

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
                  {SECTORS.map((s) => (
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
              <Label>Glosa específica (%)</Label>
              <Input type="number" value={glosaPct} onChange={(e) => setGlosaPct(e.target.value)} placeholder="5" min="0" max="100" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início do período</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim do período</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>


          <div className="space-y-2">
            <Label>Faixas de pontuação contratual</Label>
            <div className="bg-secondary rounded-lg p-3 space-y-2">
              {scoringRules.map((rule, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    value={rule.min}
                    onChange={(e) => updateScoringRule(i, "min", e.target.value)}
                    placeholder="≥ %"
                    className="text-xs h-8"
                  />
                  <Input
                    value={rule.label}
                    onChange={(e) => updateScoringRule(i, "label", e.target.value)}
                    placeholder="Faixa"
                    className="text-xs h-8"
                  />
                  <Input
                    type="number"
                    value={rule.points}
                    onChange={(e) => updateScoringRule(i, "points", e.target.value)}
                    placeholder="Pontos"
                    className="text-xs h-8"
                    step="0.25"
                  />
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground">Formato: ≥ % atingimento → Faixa → Pontos</p>
            </div>
          </div>

          {/* Preview */}
          {Number(target) > 0 && (
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-xs font-medium text-foreground mb-1">Pré-visualização</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Atingimento</p>
                  <p className="font-display font-bold text-foreground">
                    {type === "DOC"
                      ? (Number(current) >= Number(target) ? "100%" : "0%")
                      : `${Math.min(100, Math.round((Number(current) / Number(target)) * 100))}%`}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Peso</p>
                  <p className="font-display font-bold text-foreground">{weight}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Glosa</p>
                  <p className="font-display font-bold text-foreground">{glosaPct}%</p>
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
