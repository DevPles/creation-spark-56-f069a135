import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileDown } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (sections: { metas: boolean; rubricas: boolean; leitos: boolean }) => void;
  generating?: boolean;
}

const PdfExportModal = ({ open, onOpenChange, onGenerate, generating }: Props) => {
  const [sections, setSections] = useState({ metas: true, rubricas: true, leitos: true });

  const toggle = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const anySelected = sections.metas || sections.rubricas || sections.leitos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Gerar Relatório PDF
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mb-4">
          Selecione as seções que deseja incluir no relatório:
        </p>

        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
            <Checkbox id="metas" checked={sections.metas} onCheckedChange={() => toggle("metas")} />
            <Label htmlFor="metas" className="flex-1 cursor-pointer">
              <span className="font-semibold text-sm">Lançamento de Metas</span>
              <p className="text-xs text-muted-foreground">KPIs de atingimento, gráfico de barras e tabela detalhada</p>
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
            <Checkbox id="rubricas" checked={sections.rubricas} onCheckedChange={() => toggle("rubricas")} />
            <Label htmlFor="rubricas" className="flex-1 cursor-pointer">
              <span className="font-semibold text-sm">Lançamento de Rubricas</span>
              <p className="text-xs text-muted-foreground">Execução financeira por rubrica com saldos e status</p>
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
            <Checkbox id="leitos" checked={sections.leitos} onCheckedChange={() => toggle("leitos")} />
            <Label htmlFor="leitos" className="flex-1 cursor-pointer">
              <span className="font-semibold text-sm">Movimentação de Leitos</span>
              <p className="text-xs text-muted-foreground">Ocupação por clínica (internação e complementar), tendências e histórico</p>
            </Label>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onGenerate(sections)} disabled={!anySelected || generating}>
            {generating ? "Gerando..." : "Gerar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PdfExportModal;
