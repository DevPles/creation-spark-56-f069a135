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
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";

export interface EvidenceData {
  id: string;
  goalName: string;
  type: string;
  fileName: string;
  status: "Pendente" | "Enviada" | "Validada" | "Rejeitada";
  dueDate: string;
  submittedAt?: string;
  notes: string;
}

interface EvidenceFormModalProps {
  evidence: EvidenceData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (evidence: EvidenceData) => void;
  isNew?: boolean;
  goalNames?: string[];
}

const EVIDENCE_TYPES = ["PDF", "Planilha", "Ata de reunião", "Relatório", "Checklist", "Pesquisa", "Outro"];
const STATUSES: EvidenceData["status"][] = ["Pendente", "Enviada", "Validada", "Rejeitada"];

const EvidenceFormModal = ({ evidence, open, onOpenChange, onSave, isNew = false, goalNames = [] }: EvidenceFormModalProps) => {
  const [goalName, setGoalName] = useState("");
  const [type, setType] = useState("PDF");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<EvidenceData["status"]>("Pendente");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (evidence && !isNew) {
      setGoalName(evidence.goalName);
      setType(evidence.type);
      setFileName(evidence.fileName);
      setStatus(evidence.status);
      setDueDate(evidence.dueDate);
      setNotes(evidence.notes);
    } else if (isNew) {
      setGoalName(goalNames[0] || "");
      setType("PDF");
      setFileName("");
      setStatus("Pendente");
      setDueDate("");
      setNotes("");
    }
  }, [evidence, isNew, open]);

  const handleSave = () => {
    const data: EvidenceData = {
      id: evidence?.id || crypto.randomUUID(),
      goalName,
      type,
      fileName,
      status,
      dueDate,
      submittedAt: status === "Enviada" || status === "Validada" ? new Date().toLocaleDateString("pt-BR") : undefined,
      notes,
    };
    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isNew ? "Enviar evidência" : "Editar evidência"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Meta vinculada</Label>
            {goalNames.length > 0 ? (
              <Select value={goalName} onValueChange={setGoalName}>
                <SelectTrigger><SelectValue placeholder="Selecione a meta" /></SelectTrigger>
                <SelectContent>
                  {goalNames.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Nome da meta" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de evidência</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVIDENCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EvidenceData["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Prazo de entrega</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <Label>Arquivo</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              {fileName ? (
                <div>
                  <p className="text-sm text-foreground">{fileName}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setFileName("")}>Remover</Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Arraste ou selecione o arquivo</p>
                  <p className="text-[10px] text-muted-foreground mt-1">PDF, DOC, XLS até 10MB</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setFileName(`evidencia_${Date.now()}.pdf`)}>
                    Selecionar arquivo
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais sobre a evidência..." rows={3} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave}>
              {isNew ? "Enviar evidência" : "Salvar alterações"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EvidenceFormModal;
