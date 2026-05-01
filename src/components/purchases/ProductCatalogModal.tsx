import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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

const CATEGORIAS_OPME = [
  { v: "ortese", l: "Órtese" },
  { v: "protese", l: "Prótese" },
  { v: "material_especial", l: "Material Especial" },
];

const isOpmeType = (tipo: string, classificacao: string) =>
  tipo === "IMP" || classificacao === "implante";

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
  const [descricaoResumida, setDescricaoResumida] = useState("");
  const [categoriaOpme, setCategoriaOpme] = useState<string>("");
  const [unidade, setUnidade] = useState("UN");
  const [previewCode, setPreviewCode] = useState<string>("");
  const [facilityUnit, setFacilityUnit] = useState<string>("Hospital Geral");
  const [setor, setSetor] = useState<string>("");
  const [sectorOptions, setSectorOptions] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  // SIGTAP
  const [sigtapCode, setSigtapCode] = useState("");
  const [sigtapProcedures, setSigtapProcedures] = useState("");
  const [requiresPriorAuth, setRequiresPriorAuth] = useState(false);
  // Rastreabilidade
  const [requiresLote, setRequiresLote] = useState(false);
  const [requiresValidade, setRequiresValidade] = useState(false);
  const [requiresEtiqueta, setRequiresEtiqueta] = useState(false);
  const [usoUnico, setUsoUnico] = useState(false);
  const [reprocessavel, setReprocessavel] = useState(false);
  // Fornecimento
  const [fabricante, setFabricante] = useState("");
  const [fornecedorPadrao, setFornecedorPadrao] = useState("");
  const [consignado, setConsignado] = useState(false);
  // Embalagem / preço
  const [multiplicador, setMultiplicador] = useState<string>("1");
  const [precoReferencia, setPrecoReferencia] = useState<string>("");
  const [ultimoPreco, setUltimoPreco] = useState<{ valor: number; data: string; fornecedor?: string } | null>(null);

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
      setDescricaoResumida("");
      setCategoriaOpme("");
      setPreviewCode("");
      setSetor("");
      setImageUrl("");
      setSigtapCode("");
      setSigtapProcedures("");
      setRequiresPriorAuth(false);
      setRequiresLote(false);
      setRequiresValidade(false);
      setRequiresEtiqueta(false);
      setUsoUnico(false);
      setReprocessavel(false);
      setFabricante("");
      setFornecedorPadrao("");
      setConsignado(false);
      setMultiplicador("1");
      setPrecoReferencia("");
      setUltimoPreco(null);
      return;
    }
    if (editing) {
      setTipo(editing.tipo || "MMH");
      setClassificacao(editing.classificacao || "medico");
      setDescricao(editing.descricao || "");
      setDescricaoResumida(editing.descricao_resumida || "");
      setCategoriaOpme(editing.categoria_opme || "");
      setUnidade(editing.unidade_medida || "UN");
      setPreviewCode(editing.codigo || "");
      setFacilityUnit(editing.facility_unit || "Hospital Geral");
      setSetor(editing.setor || "");
      setImageUrl(editing.image_url || "");
      setSigtapCode(editing.sigtap_code || "");
      setSigtapProcedures(Array.isArray(editing.sigtap_procedures) ? editing.sigtap_procedures.join(", ") : "");
      setRequiresPriorAuth(!!editing.requires_prior_auth);
      setRequiresLote(!!editing.requires_lote);
      setRequiresValidade(!!editing.requires_validade);
      setRequiresEtiqueta(!!editing.requires_etiqueta);
      setUsoUnico(!!editing.uso_unico);
      setReprocessavel(!!editing.reprocessavel);
      setFabricante(editing.fabricante || "");
      setFornecedorPadrao(editing.fornecedor_padrao || "");
      setConsignado(!!editing.consignado);
      setMultiplicador(String(editing.multiplicador_embalagem ?? 1));
      setPrecoReferencia(editing.preco_referencia != null ? String(editing.preco_referencia) : "");
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

  // Buscar último preço praticado do banco de preços (price_history) por descrição
  useEffect(() => {
    if (!open) return;
    const term = (descricao || "").trim();
    if (term.length < 4) { setUltimoPreco(null); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("price_history")
        .select("valor_unitario, data_referencia, fornecedor_nome")
        .ilike("descricao_produto", `%${term}%`)
        .order("data_referencia", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setUltimoPreco({
          valor: Number(data[0].valor_unitario),
          data: data[0].data_referencia,
          fornecedor: data[0].fornecedor_nome || undefined,
        });
      } else {
        setUltimoPreco(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [open, descricao]);

  const opmeMode = isOpmeType(tipo, classificacao);

  const handleSave = async () => {
    if (!descricao.trim()) {
      toast.error("Informe a descrição do item");
      return;
    }
    if (!tipo || !classificacao || !unidade) {
      toast.error("Tipo, classificação e unidade são obrigatórios");
      return;
    }
    if (opmeMode && !categoriaOpme) {
      toast.error("Para itens OPME, informe a categoria (Órtese, Prótese ou Material Especial)");
      return;
    }
    setSaving(true);
    try {
      const proceduresArr = sigtapProcedures
        .split(/[,;\n]/)
        .map(s => s.trim())
        .filter(Boolean);
      const extra = {
        descricao_resumida: descricaoResumida.trim() || null,
        categoria_opme: opmeMode ? (categoriaOpme || null) : null,
        sigtap_code: sigtapCode.trim() || null,
        sigtap_procedures: proceduresArr,
        requires_prior_auth: requiresPriorAuth,
        requires_lote: requiresLote,
        requires_validade: requiresValidade,
        requires_etiqueta: requiresEtiqueta,
        uso_unico: usoUnico,
        reprocessavel: reprocessavel,
        fabricante: fabricante.trim() || null,
        fornecedor_padrao: fornecedorPadrao.trim() || null,
        consignado: consignado,
        multiplicador_embalagem: Number(multiplicador) || 1,
        preco_referencia: precoReferencia ? Number(precoReferencia) : null,
      };
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
            ...extra,
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
          ...extra,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar item do catálogo" : "Cadastrar item no catálogo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* 1. Identificação */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identificação do produto</p>
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
            <div>
              <Label>Descrição resumida (busca)</Label>
              <Input
                value={descricaoResumida}
                onChange={e => setDescricaoResumida(e.target.value)}
                placeholder="Ex: SER 10ML"
              />
            </div>
            {opmeMode && (
              <div>
                <Label>Categoria OPME</Label>
                <Select value={categoriaOpme || "__none__"} onValueChange={v => setCategoriaOpme(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— selecione —</SelectItem>
                    {CATEGORIAS_OPME.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          {/* 2. SIGTAP */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vínculo SIGTAP</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código SIGTAP</Label>
                <Input value={sigtapCode} onChange={e => setSigtapCode(e.target.value)} placeholder="Ex: 07.02.03.001-2" />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch checked={requiresPriorAuth} onCheckedChange={setRequiresPriorAuth} id="prior-auth" />
                <Label htmlFor="prior-auth" className="cursor-pointer">Exige autorização prévia</Label>
              </div>
            </div>
            <div>
              <Label>Procedimentos SIGTAP compatíveis</Label>
              <Textarea
                value={sigtapProcedures}
                onChange={e => setSigtapProcedures(e.target.value)}
                placeholder="Códigos separados por vírgula. Ex: 04.07.04.012-0, 04.07.04.013-9"
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* 3. Rastreabilidade */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regras de rastreabilidade</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="flex items-center gap-2"><Switch id="r-lote" checked={requiresLote} onCheckedChange={setRequiresLote} /><Label htmlFor="r-lote" className="cursor-pointer">Exige lote</Label></div>
              <div className="flex items-center gap-2"><Switch id="r-val" checked={requiresValidade} onCheckedChange={setRequiresValidade} /><Label htmlFor="r-val" className="cursor-pointer">Exige validade</Label></div>
              <div className="flex items-center gap-2"><Switch id="r-etq" checked={requiresEtiqueta} onCheckedChange={setRequiresEtiqueta} /><Label htmlFor="r-etq" className="cursor-pointer">Exige etiqueta</Label></div>
              <div className="flex items-center gap-2"><Switch id="r-uu" checked={usoUnico} onCheckedChange={setUsoUnico} /><Label htmlFor="r-uu" className="cursor-pointer">Uso único</Label></div>
              <div className="flex items-center gap-2"><Switch id="r-rep" checked={reprocessavel} onCheckedChange={setReprocessavel} /><Label htmlFor="r-rep" className="cursor-pointer">Reprocessável</Label></div>
            </div>
          </div>

          <Separator />

          {/* 4. Fornecimento */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fornecimento</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fabricante</Label>
                <Input value={fabricante} onChange={e => setFabricante(e.target.value)} placeholder="Ex: Johnson & Johnson" />
              </div>
              <div>
                <Label>Fornecedor padrão</Label>
                <Input value={fornecedorPadrao} onChange={e => setFornecedorPadrao(e.target.value)} placeholder="Ex: MedSul Distribuidora" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="consig" checked={consignado} onCheckedChange={setConsignado} />
              <Label htmlFor="consig" className="cursor-pointer">Material consignado</Label>
            </div>
          </div>

          <Separator />

          {/* 5. Unidade e controle */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unidade e controle</p>
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
            <div className="grid grid-cols-3 gap-3">
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
                <Label>Multiplicador / embalagem</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={multiplicador}
                  onChange={e => setMultiplicador(e.target.value)}
                />
              </div>
            <div>
              <Label>Código gerado</Label>
              <Input value={previewCode} readOnly className="font-mono" />
            </div>
            </div>
          </div>

          <Separator />

          {/* 6. Preço */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preço</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço de referência (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={precoReferencia}
                  onChange={e => setPrecoReferencia(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Último preço praticado</Label>
                <Input
                  readOnly
                  value={ultimoPreco
                    ? `R$ ${ultimoPreco.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} — ${new Date(ultimoPreco.data).toLocaleDateString("pt-BR")}`
                    : "Sem histórico no Banco de Preços"}
                  className="bg-muted/40"
                />
                {ultimoPreco?.fornecedor && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Fornecedor: {ultimoPreco.fornecedor}</p>
                )}
              </div>
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