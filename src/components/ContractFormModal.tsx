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
import { useState, useEffect, useRef } from "react";
import { ContractData, ContractFormModalProps, Rubrica, STATUSES, UNITS_LIST, DEFAULT_RUBRICAS } from "./contract/types";
import RubricaSection from "./contract/RubricaSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, X, Loader2 } from "lucide-react";

export type { ContractData } from "./contract/types";

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
  const [rubricas, setRubricas] = useState<Rubrica[]>(DEFAULT_RUBRICAS);
  const [notificationEmail, setNotificationEmail] = useState("");

  useEffect(() => {
    if (contract && !isNew) {
      setName(contract.name);
      setValue(String(contract.value));
      setVariable(String(contract.variable * 100));
      setStatus(contract.status);
      setUnit(contract.unit || "Hospital Geral");
      setGoalsCount(String(contract.goals));
      setPdfName(contract.pdfName || "");
      setNotificationEmail(contract.notificationEmail || "");
      setRubricas(contract.rubricas?.length ? contract.rubricas : DEFAULT_RUBRICAS);
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
      setNotificationEmail("");
      setPeriodStart("2024");
      setPeriodEnd("2025");
      setRubricas(DEFAULT_RUBRICAS.map((r) => ({ ...r })));
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
      notificationEmail,
      rubricas: rubricas.filter((r) => r.percent > 0),
    };
    onSave(data);
    onOpenChange(false);
  };

  const totalValue = Number(value) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <Label>Valor global mensal (R$)</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="12000000" />
            </div>
            <div className="space-y-2">
              <Label>Parte variável (%)</Label>
              <Input type="number" value={variable} onChange={(e) => setVariable(e.target.value)} placeholder="10" min="0" max="100" />
            </div>
          </div>

          {/* Rubrica breakdown - appears when value is set */}
          {totalValue > 0 && (
            <RubricaSection rubricas={rubricas} onChange={setRubricas} totalValue={totalValue} />
          )}

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

          <div className="space-y-2">
            <Label>E-mail para notificações semanais de metas baixas</Label>
            <Input type="email" value={notificationEmail} onChange={(e) => setNotificationEmail(e.target.value)} placeholder="gestor@hospital.gov.br" />
            <p className="text-[10px] text-muted-foreground">
              Recebe alertas semanais quando o atingimento médio das metas ficar abaixo da fração semanal esperada. O cálculo divide a meta mensal por 4 semanas e compara com o realizado acumulado.
            </p>
          </div>

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

          {/* Financial summary */}
          {totalValue > 0 && (
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-xs font-medium text-foreground mb-2">Resumo financeiro</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Valor global</p>
                  <p className="font-display font-bold text-foreground">R$ {(totalValue / 1000000).toFixed(1)}M</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Parte variável</p>
                  <p className="font-display font-bold text-foreground">{variable}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">R$ variável</p>
                  <p className="font-display font-bold text-risk">R$ {((totalValue * (Number(variable) / 100)) / 1000).toFixed(0)}k</p>
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
