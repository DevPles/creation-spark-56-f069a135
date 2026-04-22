import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TIPOS = [
  { v: "MMH", l: "MMH — Material Médico Hospitalar" },
  { v: "MED", l: "MED — Medicamento" },
  { v: "DIE", l: "DIE — Dieta" },
  { v: "HIG", l: "HIG — Higiene" },
  { v: "ESC", l: "ESC — Escritório" },
  { v: "DES", l: "DES — Descartável" },
  { v: "LIM", l: "LIM — Limpeza" },
  { v: "OUT", l: "OUT — Outros" },
];

const CLASSIFICACOES = [
  { v: "medico", l: "Médico" },
  { v: "medicamento", l: "Medicamento" },
  { v: "dieta", l: "Dieta" },
  { v: "higiene", l: "Higiene" },
  { v: "escritorio", l: "Escritório" },
  { v: "descartavel", l: "Descartável" },
  { v: "limpeza", l: "Limpeza" },
  { v: "outros", l: "Outros" },
];

const UNIDADES = ["UN", "PCT", "CX", "KG", "L", "ML", "PAR", "FR", "AMP"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

export default function ProductCatalogModal({ open, onOpenChange, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState("MMH");
  const [classificacao, setClassificacao] = useState("medico");
  const [descricao, setDescricao] = useState("");
  const [unidade, setUnidade] = useState("UN");
  const [previewCode, setPreviewCode] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setDescricao("");
      setPreviewCode("");
      return;
    }
    const loadPreview = async () => {
      const prefix = `${tipo}-${classificacao.slice(0, 4).toUpperCase()}`;
      const { data } = await supabase
        .from("product_catalog")
        .select("codigo")
        .like("codigo", `${prefix}-%`);
      const max = (data || []).reduce((acc: number, row: any) => {
        const m = /-(\d+)$/.exec(row.codigo);
        const n = m ? parseInt(m[1], 10) : 0;
        return n > acc ? n : acc;
      }, 0);
      setPreviewCode(`${prefix}-${String(max + 1).padStart(4, "0")}`);
    };
    loadPreview();
  }, [open, tipo, classificacao]);

  const handleSave = async () => {
    if (!descricao.trim()) {
      toast.error("Informe a descrição do item");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("product_catalog").insert({
        codigo: "",
        tipo,
        classificacao,
        descricao: descricao.trim(),
        unidade_medida: unidade,
      } as any);
      if (error) throw error;
      toast.success(`Item cadastrado (${previewCode})`);
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao cadastrar item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar item no catálogo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Classificação</Label>
              <Select value={classificacao} onValueChange={setClassificacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLASSIFICACOES.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição técnica</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Seringa 10 ml" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unidade</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Código gerado</Label>
              <Input value={previewCode} readOnly className="font-mono" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-full" disabled={saving} onClick={handleSave}>{saving ? "Salvando..." : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}