import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import ProductCatalogModal from "./ProductCatalogModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CLASSIF_LABEL: Record<string, string> = {
  alimenticio: "Alimentício",
  audiovisual: "Audiovisual",
  descartavel: "Descartável",
  dieta: "Dieta",
  eletrico: "Elétrico",
  engenharia_clinica: "Engenharia Clínica",
  epi: "EPI",
  escritorio: "Escritório",
  farmaceutico: "Farmacêutico",
  gases: "Gases Medicinais",
  grafico: "Gráfico",
  hidraulico: "Hidráulico",
  higiene: "Higiene",
  hotelaria: "Hotelaria",
  implante: "Implante / OPME",
  informatica: "Informática / TI",
  laboratorial: "Laboratorial",
  lavanderia: "Lavanderia",
  limpeza: "Limpeza",
  manutencao: "Manutenção",
  medicamento: "Medicamento",
  medico: "Médico",
  mobiliario: "Mobiliário",
  odontologico: "Odontológico",
  outros: "Outros",
  quimico: "Químico",
  radiologico: "Radiológico",
  rouparia: "Rouparia",
  seguranca: "Segurança",
  servico: "Serviço",
  telecom: "Telecomunicações",
  uniforme: "Uniforme",
  veicular: "Veicular",
};
const CLASSIFICACOES = Object.keys(CLASSIF_LABEL).sort((a, b) => CLASSIF_LABEL[a].localeCompare(CLASSIF_LABEL[b]));
const JUSTIFICATIVAS = [
  { v: "mensal", l: "Compra mensal" },
  { v: "especifica", l: "Compra específica" },
  { v: "emergencial", l: "Emergencial" },
  { v: "outros", l: "Outros" },
];
const UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"];

interface Item {
  id?: string;
  item_num: number;
  codigo?: string;
  product_id?: string | null;
  image_url?: string | null;
  descricao: string;
  quantidade: number;
  unidade_medida: string;
  observacao?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requisition: any | null;
  onSaved: () => void;
}

export default function PurchaseRequisitionModal({ open, onOpenChange, requisition, onSaved }: Props) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [facilityUnit, setFacilityUnit] = useState(profile?.facility_unit || "Hospital Geral");
  const [setor, setSetor] = useState("");
  const [sectorOptions, setSectorOptions] = useState<string[]>([]);
  const [municipio, setMunicipio] = useState("");
  const [classificacao, setClassificacao] = useState<string[]>([]);
  const [justificativa, setJustificativa] = useState("mensal");
  const [observacoes, setObservacoes] = useState("");
  const [solicitante, setSolicitante] = useState(profile?.name || "");
  const [aprovadorImediato, setAprovadorImediato] = useState("");
  const [aprovadorDiretoria, setAprovadorDiretoria] = useState("");
  const [items, setItems] = useState<Item[]>([{ item_num: 1, descricao: "", quantidade: 1, unidade_medida: "UN" }]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const loadCatalog = async () => {
    const { data } = await supabase.from("product_catalog").select("*").eq("ativo", true).order("descricao");
    setCatalog(data || []);
  };

  useEffect(() => {
    if (!open) return;
    loadCatalog();
  }, [open]);

  useEffect(() => {
    if (!open || !facilityUnit) return;
    supabase.from("sectors").select("name").eq("facility_unit", facilityUnit).order("name").then(({ data }) => {
      setSectorOptions((data || []).map((s: any) => s.name));
    });
  }, [open, facilityUnit]);

  useEffect(() => {
    if (!open) return;
    if (requisition) {
      setFacilityUnit(requisition.facility_unit);
      setSetor(requisition.setor || "");
      setMunicipio(requisition.municipio || "");
      setClassificacao(requisition.classificacao || []);
      setJustificativa(requisition.justificativa_tipo || "mensal");
      setObservacoes(requisition.observacoes || "");
      setSolicitante(requisition.solicitante_nome || "");
      setAprovadorImediato(requisition.aprovador_imediato_nome || "");
      setAprovadorDiretoria(requisition.aprovador_diretoria_nome || "");
      supabase.from("purchase_requisition_items").select("*").eq("requisition_id", requisition.id).order("item_num").then(({ data }) => {
        setItems((data || []).map((i: any) => {
          const raw: string = i.observacao || "";
          const codMatch = raw.match(/^\[COD:([^\]]+)\]\s?/);
          const codigo = codMatch ? codMatch[1] : undefined;
          const observacao = codMatch ? raw.replace(codMatch[0], "").trim() : raw;
          const prod = codigo ? catalog.find(c => c.codigo === codigo) : null;
          return {
            id: i.id,
            item_num: i.item_num,
            codigo,
            product_id: i.product_id || prod?.id || null,
            image_url: prod?.image_url || null,
            descricao: i.descricao,
            quantidade: Number(i.quantidade),
            unidade_medida: i.unidade_medida,
            observacao: observacao || undefined,
          };
        }));
      });
    } else {
      setFacilityUnit(profile?.facility_unit || "Hospital Geral");
      setSetor("");
      setMunicipio("");
      setClassificacao([]);
      setJustificativa("mensal");
      setObservacoes("");
      setSolicitante(profile?.name || "");
      setAprovadorImediato("");
      setAprovadorDiretoria("");
      setItems([{ item_num: 1, descricao: "", quantidade: 1, unidade_medida: "UN" }]);
    }
  }, [open, requisition, profile]);

  const toggleClassif = (c: string) => {
    setClassificacao(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const addItem = () => setItems(prev => [...prev, { item_num: prev.length + 1, descricao: "", quantidade: 1, unidade_medida: "UN" }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx).map((x, i) => ({ ...x, item_num: i + 1 })));
  const updateItem = (idx: number, field: keyof Item, value: any) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const pickCatalog = (idx: number, codigo: string) => {
    const prod = catalog.find(c => c.codigo === codigo);
    if (!prod) return;
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      codigo: prod.codigo,
      product_id: prod.id,
      image_url: prod.image_url || null,
      descricao: prod.descricao,
      unidade_medida: prod.unidade_medida || "UN",
    } : it));
  };

  const [descFocusIdx, setDescFocusIdx] = useState<number | null>(null);

  const getSuggestions = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return catalog
      .filter(c =>
        (c.descricao || "").toLowerCase().includes(q) ||
        (c.codigo || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  };

  const applySuggestion = (idx: number, prod: any) => {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      codigo: prod.codigo,
      product_id: prod.id,
      image_url: prod.image_url || null,
      descricao: prod.descricao,
      unidade_medida: prod.unidade_medida || it.unidade_medida || "UN",
    } : it));
    setDescFocusIdx(null);
  };

  const generateNumero = () => {
    const year = new Date().getFullYear();
    const seq = Math.floor(Math.random() * 999).toString().padStart(3, "0");
    return `010/${seq}/${year}`;
  };

  const handleSave = async () => {
    if (items.filter(i => i.descricao.trim()).length === 0) {
      toast.error("Adicione ao menos um item");
      return;
    }
    if (!profile) return;
    setSaving(true);
    try {
      let reqId = requisition?.id;
      const payload = {
        facility_unit: facilityUnit,
        setor: setor || null,
        municipio: municipio || null,
        classificacao,
        justificativa_tipo: justificativa,
        observacoes: observacoes || null,
        solicitante_id: profile.id,
        solicitante_nome: solicitante,
        aprovador_imediato_nome: aprovadorImediato || null,
        aprovador_diretoria_nome: aprovadorDiretoria || null,
      };
      if (reqId) {
        const { error } = await supabase.from("purchase_requisitions").update(payload).eq("id", reqId);
        if (error) throw error;
        await supabase.from("purchase_requisition_items").delete().eq("requisition_id", reqId);
      } else {
        const { data, error } = await supabase.from("purchase_requisitions").insert({
          ...payload,
          numero: generateNumero(),
          status: "aguardando_cotacao",
          created_by: profile.id,
        }).select().single();
        if (error) throw error;
        reqId = data.id;
      }
      const validItems = items.filter(i => i.descricao.trim()).map((i, idx) => ({
        requisition_id: reqId,
        item_num: idx + 1,
        product_id: i.product_id || null,
        descricao: i.descricao,
        quantidade: Number(i.quantidade) || 0,
        unidade_medida: i.unidade_medida || "UN",
        observacao: i.codigo
          ? `[COD:${i.codigo}]${i.observacao ? " " + i.observacao : ""}`
          : (i.observacao || null),
      }));
      if (validItems.length) {
        const { error: e2 } = await supabase.from("purchase_requisition_items").insert(validItems);
        if (e2) throw e2;
      }
      await supabase.from("purchase_audit_log").insert({
        entity_type: "requisition", entity_id: reqId,
        action: requisition ? "updated" : "created",
        changed_by: profile.id, changed_by_name: profile.name,
      });
      toast.success("Requisição salva");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{requisition ? "Editar requisição" : "Nova requisição de compra"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Unidade</Label>
              <Select value={facilityUnit} onValueChange={setFacilityUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Setor</Label>
              {sectorOptions.length > 0 ? (
                <Select value={setor} onValueChange={setSetor}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{sectorOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input value={setor} onChange={e => setSetor(e.target.value)} placeholder="Cadastre setores na unidade" />
              )}
            </div>
            <div><Label>Município</Label><Input value={municipio} onChange={e => setMunicipio(e.target.value)} /></div>
          </div>

          <div>
            <Label>Classificação</Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="mt-1 flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-left hover:bg-accent/30"
                >
                  <span className="truncate">
                    {classificacao.length === 0
                      ? "Selecione uma ou mais classificações"
                      : classificacao.map(c => CLASSIF_LABEL[c]).join(", ")}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {classificacao.length > 0 ? `${classificacao.length} selecionada(s)` : ""}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0 w-[360px]"
                align="start"
                onWheel={(e) => e.stopPropagation()}
              >
                <div
                  className="max-h-72 overflow-y-auto overscroll-contain py-1"
                  onWheel={(e) => e.stopPropagation()}
                  style={{ pointerEvents: "auto" }}
                >
                  {CLASSIFICACOES.map(c => (
                    <label
                      key={c}
                      className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                    >
                      <Checkbox checked={classificacao.includes(c)} onCheckedChange={() => toggleClassif(c)} />
                      {CLASSIF_LABEL[c]}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Justificativa</Label>
              <Select value={justificativa} onValueChange={setJustificativa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{JUSTIFICATIVAS.map(j => <SelectItem key={j.v} value={j.v}>{j.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Solicitante</Label><Input value={solicitante} onChange={e => setSolicitante(e.target.value)} /></div>
            <div><Label>Aprovador imediato</Label><Input value={aprovadorImediato} onChange={e => setAprovadorImediato(e.target.value)} /></div>
            <div><Label>Aprovador diretoria</Label><Input value={aprovadorDiretoria} onChange={e => setAprovadorDiretoria(e.target.value)} /></div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setCatalogOpen(true)}>Cadastrar item no catálogo</Button>
                <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={addItem}>Adicionar linha</Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-40">Código</TableHead>
                  <TableHead className="w-[260px]">Descrição</TableHead>
                  <TableHead className="w-24">Qtd</TableHead>
                  <TableHead className="w-24">Un</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <Select value={it.codigo || ""} onValueChange={(v) => pickCatalog(idx, v)}>
                        <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {catalog.map(c => (
                            <SelectItem key={c.id} value={c.codigo}>
                              <span className="font-mono mr-2">{c.codigo}</span>
                              <span className="text-xs text-muted-foreground">{c.descricao.slice(0, 50)}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <Popover
                        open={descFocusIdx === idx && getSuggestions(it.descricao).length > 0}
                        onOpenChange={(o) => { if (!o) setDescFocusIdx(null); }}
                      >
                        <PopoverTrigger asChild>
                          <Input
                            value={it.descricao}
                            onChange={e => { updateItem(idx, "descricao", e.target.value); setDescFocusIdx(idx); }}
                            onFocus={() => setDescFocusIdx(idx)}
                            onBlur={() => setTimeout(() => setDescFocusIdx(c => c === idx ? null : c), 150)}
                            placeholder="Digite para buscar no catálogo..."
                            title={it.descricao}
                            className={
                              descFocusIdx === idx
                                ? "w-full"
                                : "w-full text-ellipsis overflow-hidden whitespace-nowrap"
                            }
                          />
                        </PopoverTrigger>
                        <PopoverContent
                          className="p-0 w-[360px]"
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                          onInteractOutside={() => setDescFocusIdx(null)}
                          onPointerDownOutside={() => setDescFocusIdx(null)}
                          onWheel={(e) => e.stopPropagation()}
                        >
                          <div
                            className="max-h-64 overflow-y-auto overscroll-contain"
                            onWheel={(e) => e.stopPropagation()}
                            style={{ pointerEvents: "auto" }}
                          >
                            {getSuggestions(it.descricao).map(prod => (
                              <button
                                type="button"
                                key={prod.id}
                                onMouseDown={(e) => { e.preventDefault(); applySuggestion(idx, prod); }}
                                className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-b-0"
                              >
                                <div className="font-mono text-xs text-primary">{prod.codigo}</div>
                                <div className="text-foreground">{prod.descricao}</div>
                                <div className="text-xs text-muted-foreground">{prod.unidade_medida}</div>
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell><Input type="number" value={it.quantidade} onChange={e => updateItem(idx, "quantidade", e.target.value)} /></TableCell>
                    <TableCell><Input value={it.unidade_medida} onChange={e => updateItem(idx, "unidade_medida", e.target.value)} /></TableCell>
                    <TableCell><Input value={it.observacao || ""} onChange={e => updateItem(idx, "observacao", e.target.value)} /></TableCell>
                    <TableCell><Button type="button" size="sm" variant="ghost" onClick={() => removeItem(idx)}>Remover</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-full" disabled={saving} onClick={handleSave}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
      <ProductCatalogModal open={catalogOpen} onOpenChange={setCatalogOpen} onSaved={loadCatalog} />
    </Dialog>
  );
}