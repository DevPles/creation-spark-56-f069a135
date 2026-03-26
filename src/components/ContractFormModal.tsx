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

export interface ContractData {
  id: string;
  name: string;
  value: number;
  variable: number;
  goals: number;
  status: string;
  period: string;
  unit: string;
  pdfName?: string;
}

interface ContractFormModalProps {
  contract: ContractData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (contract: ContractData) => void;
  isNew?: boolean;
}

const STATUSES = ["Vigente", "Em renovação", "Encerrado"];
const UNITS_LIST = ["Hospital Geral", "UPA Norte", "UBS Centro"];

const ContractFormModal = ({ contract, open, onOpenChange, onSave, isNew = false }: ContractFormModalProps) => {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [variable, setVariable] = useState("");
  const [status, setStatus] = useState("Vigente");
  const [periodStart, setPeriodStart] = useState("2024");
  const [periodEnd, setPeriodEnd] = useState("2025");
  const [unit, setUnit] = useState("Hospital Geral");
  const [goalsCount, setGoalsCount] = useState("0");
  const [pdfName, setPdfName] = useState("");

  useEffect(() => {
    if (contract && !isNew) {
      setName(contract.name);
      setValue(String(contract.value));
      setVariable(String(contract.variable * 100));
      setStatus(contract.status);
      setUnit(contract.unit || "Hospital Geral");
      setGoalsCount(String(contract.goals));
      setPdfName(contract.pdfName || "");
      const parts = contract.period.split("-");
      if (parts.length === 2) {
        setPeriodStart(parts[0]);
        setPeriodEnd(parts[1]);
      }
    } else if (isNew) {
      setName("");
      setValue("");
      setVariable("10");
      setStatus("Vigente");
      setUnit("Hospital Geral");
      setGoalsCount("0");
      setPdfName("");
      setPeriodStart("2024");
      setPeriodEnd("2025");
    }
  }, [contract, isNew, open]);

  const handleSave = () => {
    const data: ContractData = {
      id: contract?.id || crypto.randomUUID(),
      name: name || `Contrato de Gestão — ${unit}`,
      value: Number(value) || 0,
      variable: (Number(variable) || 10) / 100,
      goals: Number(goalsCount) || 0,
      status,
      period: `${periodStart}-${periodEnd}`,
      unit,
      pdfName,
    };
    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isNew ? "Novo contrato" : "Editar contrato"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do contrato</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contrato de Gestão — Hospital Geral" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS_LIST.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor total (R$)</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="12000000" />
            </div>
            <div className="space-y-2">
              <Label>Parte variável (%)</Label>
              <Input type="number" value={variable} onChange={(e) => setVariable(e.target.value)} placeholder="10" min="0" max="100" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Vigência início</Label>
              <Input value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} placeholder="2024" />
            </div>
            <div className="space-y-2">
              <Label>Vigência fim</Label>
              <Input value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} placeholder="2025" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nº de metas vinculadas</Label>
            <Input type="number" value={goalsCount} onChange={(e) => setGoalsCount(e.target.value)} placeholder="8" />
          </div>

          {/* PDF upload area */}
          <div className="space-y-2">
            <Label>PDF do contrato</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              {pdfName ? (
                <div>
                  <p className="text-sm text-foreground">{pdfName}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setPdfName("")}>Remover</Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Arraste ou selecione o arquivo PDF</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setPdfName("Contrato_Gestao_2024.pdf")}>
                    Selecionar arquivo
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Financial summary preview */}
          {Number(value) > 0 && (
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-xs font-medium text-foreground mb-2">Resumo financeiro</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Valor total</p>
                  <p className="font-display font-bold text-foreground">R$ {(Number(value) / 1000000).toFixed(1)}M</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Parte variável</p>
                  <p className="font-display font-bold text-foreground">{variable}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">R$ variável</p>
                  <p className="font-display font-bold text-risk">R$ {((Number(value) * (Number(variable) / 100)) / 1000).toFixed(0)}k</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave}>
              {isNew ? "Cadastrar contrato" : "Salvar alterações"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContractFormModal;
