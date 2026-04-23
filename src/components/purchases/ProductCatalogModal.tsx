import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImagePlus, X, Loader2 } from "lucide-react";

const TIPOS = [
  { v: "ALI", l: "ALI — Alimentos e Gêneros Alimentícios" },
  { v: "AUD", l: "AUD — Audiovisual e Comunicação" },
  { v: "COP", l: "COP — Copa e Cozinha" },
  { v: "DES", l: "DES — Descartável" },
  { v: "DIE", l: "DIE — Dieta e Nutrição Enteral" },
  { v: "ENG", l: "ENG — Engenharia Clínica" },
  { v: "EPI", l: "EPI — Equipamento de Proteção Individual" },
  { v: "ESC", l: "ESC — Escritório e Papelaria" },
  { v: "FAR", l: "FAR — Farmácia / Insumos Farmacêuticos" },
  { v: "GAS", l: "GAS — Gases Medicinais" },
  { v: "GRA", l: "GRA — Gráfica e Impressos" },
  { v: "HIG", l: "HIG — Higiene Pessoal" },
  { v: "HOT", l: "HOT — Hotelaria Hospitalar" },
  { v: "IMP", l: "IMP — Implantes e Próteses (OPME)" },
  { v: "INF", l: "INF — Informática e TI" },
  { v: "LAB", l: "LAB — Laboratório e Reagentes" },
  { v: "LAV", l: "LAV — Lavanderia e Processamento" },
  { v: "LIM", l: "LIM — Limpeza e Conservação" },
  { v: "MAN", l: "MAN — Manutenção Predial" },
  { v: "MED", l: "MED — Medicamento" },
  { v: "MMH", l: "MMH — Material Médico Hospitalar" },
  { v: "MOB", l: "MOB — Mobiliário" },
  { v: "ODO", l: "ODO — Odontológico" },
  { v: "OUT", l: "OUT — Outros" },
  { v: "QUI", l: "QUI — Químicos e Saneantes" },
  { v: "RAD", l: "RAD — Radiologia e Imagem" },
  { v: "ROU", l: "ROU — Rouparia e Enxoval" },
  { v: "SEG", l: "SEG — Segurança e Vigilância" },
  { v: "SER", l: "SER — Serviços Terceirizados" },
  { v: "TEL", l: "TEL — Telefonia e Comunicação" },
  { v: "UNI", l: "UNI — Uniformes e Vestuário" },
  { v: "VEI", l: "VEI — Veículos e Frota" },
];

const CLASSIFICACOES = [
  { v: "alimenticio", l: "Alimentício" },
  { v: "audiovisual", l: "Audiovisual" },
  { v: "descartavel", l: "Descartável" },
  { v: "dieta", l: "Dieta" },
  { v: "elétrico", l: "Elétrico" },
  { v: "engenharia_clinica", l: "Engenharia Clínica" },
  { v: "epi", l: "EPI" },
  { v: "escritorio", l: "Escritório" },
  { v: "farmaceutico", l: "Farmacêutico" },
  { v: "gases", l: "Gases Medicinais" },
  { v: "grafico", l: "Gráfico" },
  { v: "hidraulico", l: "Hidráulico" },
  { v: "higiene", l: "Higiene" },
  { v: "hotelaria", l: "Hotelaria" },
  { v: "implante", l: "Implante / OPME" },
  { v: "informatica", l: "Informática / TI" },
  { v: "laboratorial", l: "Laboratorial" },
  { v: "lavanderia", l: "Lavanderia" },
  { v: "limpeza", l: "Limpeza" },
  { v: "manutencao", l: "Manutenção" },
  { v: "medicamento", l: "Medicamento" },
  { v: "medico", l: "Médico" },
  { v: "mobiliario", l: "Mobiliário" },
  { v: "odontologico", l: "Odontológico" },
  { v: "outros", l: "Outros" },
  { v: "quimico", l: "Químico" },
  { v: "radiologico", l: "Radiológico" },
  { v: "rouparia", l: "Rouparia" },
  { v: "seguranca", l: "Segurança" },
  { v: "servico", l: "Serviço" },
  { v: "telecom", l: "Telecomunicações" },
  { v: "uniforme", l: "Uniforme" },
  { v: "veicular", l: "Veicular" },
];

const UNIDADES = [
  "AMP", "BD", "BL", "CJ", "CX", "DZ", "FR", "G", "GL", "HR",
  "KG", "KIT", "L", "LT", "M", "M2", "M3", "MES", "MG", "ML",
  "PAR", "PC", "PCT", "RL", "SC", "SV", "TB", "UN",
];

const FACILITY_UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
  editing?: any | null;
}

export default function ProductCatalogModal({ open, onOpenChange, onSaved, editing }: Props) {
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState("MMH");
  const [classificacao, setClassificacao] = useState("medico");
  const [descricao, setDescricao] = useState("");
  const [unidade, setUnidade] = useState("UN");
  const [previewCode, setPreviewCode] = useState<string>("");
  const [facilityUnit, setFacilityUnit] = useState<string>("Hospital Geral");
  const [setor, setSetor] = useState<string>("");
  const [sectorOptions, setSectorOptions] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("sectors")
        .select("name")
        .eq("facility_unit", facilityUnit)
        .order("name");
      setSectorOptions((data || []).map((s: any) => s.name));
    })();
  }, [open, facilityUnit]);

  useEffect(() => {
    if (!open) {
      setDescricao("");
      setPreviewCode("");
      setSetor("");
      setImageUrl("");
      return;
    }
    if (editing) {
      setTipo(editing.tipo || "MMH");
      setClassificacao(editing.classificacao || "medico");
      setDescricao(editing.descricao || "");
      setUnidade(editing.unidade_medida || "UN");
      setPreviewCode(editing.codigo || "");
      setFacilityUnit(editing.facility_unit || "Hospital Geral");
      setSetor(editing.setor || "");
      setImageUrl(editing.image_url || "");
      return;
    }
    setImageUrl("");
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
  }, [open, tipo, classificacao, editing]);

  const handleSave = async () => {
    if (!descricao.trim()) {
      toast.error("Informe a descrição do item");
      return;
    }
    setSaving(true);
    try {
      if (editing?.id) {
        const { error } = await supabase
          .from("product_catalog")
          .update({
            tipo,
            classificacao,
            descricao: descricao.trim(),
            unidade_medida: unidade,
            facility_unit: facilityUnit,
            setor: setor || null,
            image_url: imageUrl || null,
          } as any)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Item atualizado");
      } else {
        const { error } = await supabase.from("product_catalog").insert({
          codigo: "",
          tipo,
          classificacao,
          descricao: descricao.trim(),
          unidade_medida: unidade,
          facility_unit: facilityUnit,
          setor: setor || null,
          image_url: imageUrl || null,
        } as any);
        if (error) throw error;
        toast.success(`Item cadastrado (${previewCode})`);
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar item");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 10 MB)");
      return;
    }
    if (!/^image\/(jpeg|png|webp|jpg)$/i.test(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${editing?.id || "novo"}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(pub.publicUrl);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar imagem");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar item do catálogo" : "Cadastrar item no catálogo"}</DialogTitle>
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
            <div className="flex items-center gap-2">
              <label
                title={imageUrl ? "Trocar imagem do produto" : "Adicionar imagem do produto"}
                className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-input bg-muted/40 hover:bg-muted overflow-hidden transition-colors"
              >
                {imageUrl ? (
                  <img src={imageUrl} alt="Produto" className="h-full w-full object-cover" />
                ) : uploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                  disabled={uploadingImage}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <Input
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Ex: Seringa 10 ml"
                className="flex-1"
              />
              {imageUrl && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  title="Remover imagem"
                  onClick={() => setImageUrl("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Imagem opcional (JPG/PNG/WEBP, até 10 MB) — exibida no convite ao fornecedor.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unidade hospitalar</Label>
              <Select value={facilityUnit} onValueChange={(v) => { setFacilityUnit(v); setSetor(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FACILITY_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Setor</Label>
              <Select value={setor || "__none__"} onValueChange={(v) => setSetor(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— sem setor —</SelectItem>
                  {sectorOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
          <Button className="rounded-full" disabled={saving} onClick={handleSave}>
            {saving ? (<><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>) : (editing ? "Salvar" : "Cadastrar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}