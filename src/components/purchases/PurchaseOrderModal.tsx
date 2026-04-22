import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quotationId?: string;
  orderId?: string;
  onSaved: () => void;
}

export default function PurchaseOrderModal({ open, onOpenChange, quotationId, orderId, onSaved }: Props) {
  const { profile, isAdmin, role } = useAuth();
  const canApprove = isAdmin || role === "gestor";
  const [saving, setSaving] = useState(false);

  const [order, setOrder] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractId, setContractId] = useState<string>("");
  const [rubricaId, setRubricaId] = useState<string>("");
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [fornecedor, setFornecedor] = useState("");
  const [fornecedorCnpj, setFornecedorCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [prazo, setPrazo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [motivoNegacao, setMotivoNegacao] = useState("");
  const [facilityUnit, setFacilityUnit] = useState("");
  const [reqId, setReqId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data: cs } = await supabase.from("contracts").select("*");
      setContracts(cs || []);
      const { data: allOrders } = await supabase.from("purchase_orders").select("*").in("status", ["autorizada", "enviada", "recebida"]);
      setOrders(allOrders || []);

      if (orderId) {
        const { data: o } = await supabase.from("purchase_orders").select("*").eq("id", orderId).single();
        setOrder(o);
        setContractId(o?.contract_id || "");
        setRubricaId(o?.rubrica_id || "");
        setFornecedor(o?.fornecedor_nome || "");
        setFornecedorCnpj(o?.fornecedor_cnpj || "");
        setEndereco(o?.endereco_entrega || "");
        setPrazo(o?.prazo_entrega || "");
        setObservacoes(o?.observacoes || "");
        setFacilityUnit(o?.facility_unit || "");
        setReqId(o?.requisition_id || null);
        const { data: itemsData } = await supabase.from("purchase_order_items").select("*").eq("purchase_order_id", orderId).order("item_num");
        setItems(itemsData || []);
      } else if (quotationId) {
        // Pre-fill from quotation winner
        const { data: q } = await supabase.from("purchase_quotations").select("*").eq("id", quotationId).single();
        if (!q) return;
        setFacilityUnit(q.facility_unit);
        setReqId(q.requisition_id);
        setFornecedor(q.winner_supplier || "");
        const { data: sups } = await supabase.from("purchase_quotation_suppliers").select("*").eq("quotation_id", quotationId);
        const winner = (sups || []).find((s: any) => s.fornecedor_nome === q.winner_supplier);
        if (winner) {
          setFornecedorCnpj(winner.fornecedor_cnpj || "");
          setPrazo(winner.prazo_entrega || "");
        }
        // Build items from winning prices
        const { data: prices } = await supabase.from("purchase_quotation_prices").select("*").eq("quotation_id", quotationId).eq("is_winner", true);
        const { data: reqItems } = await supabase.from("purchase_requisition_items").select("*").eq("requisition_id", q.requisition_id).order("item_num");
        const orderItems = (reqItems || []).map((ri: any, idx: number) => {
          const wp = (prices || []).find((p: any) => p.requisition_item_id === ri.id);
          const unit = wp ? Number(wp.valor_unitario) : 0;
          return {
            item_num: idx + 1,
            descricao: ri.descricao,
            quantidade: Number(ri.quantidade),
            unidade_medida: ri.unidade_medida,
            valor_unitario: unit,
            valor_total: unit * Number(ri.quantidade),
          };
        });
        setItems(orderItems);
      }
    };
    load();
  }, [open, orderId, quotationId]);

  const valorTotal = useMemo(() => items.reduce((s, i) => s + Number(i.valor_total || 0), 0), [items]);

  const contract = contracts.find(c => c.id === contractId);
  const rubricas: any[] = (contract?.rubricas as any[]) || [];
  const selectedRubrica = rubricas.find(r => r.id === rubricaId);
  const rubricaBudget = selectedRubrica && contract ? Number(contract.value) * Number(selectedRubrica.percent) / 100 : 0;
  const rubricaSpent = orders
    .filter(o => o.contract_id === contractId && o.rubrica_id === rubricaId && o.id !== order?.id)
    .reduce((s, o) => s + Number(o.valor_total || 0), 0);
  const rubricaPct = rubricaBudget > 0 ? ((rubricaSpent + valorTotal) / rubricaBudget) * 100 : 0;
  const wouldExceed = rubricaBudget > 0 && (rubricaSpent + valorTotal) > rubricaBudget;

  const generateNumero = () => `OC/${Math.floor(Math.random() * 999).toString().padStart(3, "0")}/${new Date().getFullYear()}`;

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, [field]: value };
      if (field === "valor_unitario" || field === "quantidade") {
        next.valor_total = Number(next.valor_unitario) * Number(next.quantidade);
      }
      return next;
    }));
  };

  const saveDraft = async () => {
    if (!profile) return;
    if (!fornecedor.trim()) { toast.error("Informe o fornecedor"); return; }
    setSaving(true);
    try {
      const payload: any = {
        quotation_id: quotationId || null,
        requisition_id: reqId,
        facility_unit: facilityUnit,
        contract_id: contractId || null,
        rubrica_id: rubricaId || null,
        rubrica_name: selectedRubrica?.name || null,
        fornecedor_nome: fornecedor,
        fornecedor_cnpj: fornecedorCnpj || null,
        endereco_entrega: endereco || null,
        prazo_entrega: prazo || null,
        valor_total: valorTotal,
        observacoes: observacoes || null,
        responsavel_emissao_nome: profile.name,
        cargo: profile.cargo || null,
      };
      let oid = order?.id;
      if (oid) {
        await supabase.from("purchase_orders").update(payload).eq("id", oid);
        await supabase.from("purchase_order_items").delete().eq("purchase_order_id", oid);
      } else {
        const { data, error } = await supabase.from("purchase_orders").insert({
          ...payload, numero: generateNumero(), status: "aguardando_aprovacao", created_by: profile.id,
        }).select().single();
        if (error) throw error;
        oid = data.id;
      }
      const itemRows = items.map((it, idx) => ({
        purchase_order_id: oid, item_num: idx + 1,
        descricao: it.descricao, quantidade: it.quantidade,
        unidade_medida: it.unidade_medida, valor_unitario: it.valor_unitario,
        valor_total: it.valor_total,
      }));
      if (itemRows.length) await supabase.from("purchase_order_items").insert(itemRows);
      await supabase.from("purchase_audit_log").insert({
        entity_type: "purchase_order", entity_id: oid,
        action: order ? "updated" : "created",
        changed_by: profile.id, changed_by_name: profile.name,
      });
      toast.success("Ordem de compra salva");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const authorize = async () => {
    if (!order || !profile) return;
    if (wouldExceed && !isAdmin) { toast.error("Saldo insuficiente na rubrica selecionada"); return; }
    setSaving(true);
    try {
      await supabase.from("purchase_orders").update({
        status: "autorizada", aprovado_por: profile.id, aprovado_em: new Date().toISOString(),
      }).eq("id", order.id);
      // Register rubric execution
      if (contractId && selectedRubrica) {
        await supabase.from("rubrica_entries").insert({
          contract_id: contractId,
          rubrica_name: selectedRubrica.name,
          facility_unit: facilityUnit,
          period: new Date().toLocaleDateString("pt-BR"),
          value_executed: valorTotal,
          notes: `OC ${order.numero}`,
          user_id: profile.id,
        });
      }
      await supabase.from("purchase_audit_log").insert({
        entity_type: "purchase_order", entity_id: order.id,
        action: "authorized",
        changed_by: profile.id, changed_by_name: profile.name,
      });
      toast.success("Ordem autorizada");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao autorizar");
    } finally { setSaving(false); }
  };

  const deny = async () => {
    if (!order || !profile) return;
    if (!motivoNegacao.trim()) { toast.error("Informe o motivo da negação"); return; }
    setSaving(true);
    try {
      await supabase.from("purchase_orders").update({
        status: "negada", motivo_negacao: motivoNegacao,
        aprovado_por: profile.id, aprovado_em: new Date().toISOString(),
      }).eq("id", order.id);
      await supabase.from("purchase_audit_log").insert({
        entity_type: "purchase_order", entity_id: order.id,
        action: "denied", motivo: motivoNegacao,
        changed_by: profile.id, changed_by_name: profile.name,
      });
      toast.success("Ordem negada");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao negar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{order ? `Ordem de compra ${order.numero}` : "Nova ordem de compra"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {order && <Badge variant="outline">Status: {order.status}</Badge>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Contrato</Label>
              <Select value={contractId} onValueChange={(v) => { setContractId(v); setRubricaId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {contracts.filter(c => !facilityUnit || c.unit === facilityUnit).map(c =>
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rubrica</Label>
              <Select value={rubricaId} onValueChange={setRubricaId} disabled={!contractId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {rubricas.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name} ({r.percent}%)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedRubrica && (
            <div className={`p-3 rounded-md text-sm ${wouldExceed ? "bg-red-50 dark:bg-red-950/40" : "bg-muted"}`}>
              Rubrica <strong>{selectedRubrica.name}</strong>: {fmtBRL(rubricaSpent)} já gasto + {fmtBRL(valorTotal)} desta OC
              {" / "} <strong>{fmtBRL(rubricaBudget)}</strong> orçado ({rubricaPct.toFixed(1)}%)
              {wouldExceed && <div className="text-red-600 mt-1 font-medium">Atenção: ultrapassa o saldo da rubrica</div>}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Fornecedor</Label><Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} /></div>
            <div><Label>CNPJ</Label><Input value={fornecedorCnpj} onChange={e => setFornecedorCnpj(e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Endereço de entrega</Label><Input value={endereco} onChange={e => setEndereco(e.target.value)} /></div>
            <div><Label>Prazo de entrega</Label><Input value={prazo} onChange={e => setPrazo(e.target.value)} /></div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20">Qtd</TableHead>
                <TableHead className="w-20">Un</TableHead>
                <TableHead className="w-32 text-right">Valor unt.</TableHead>
                <TableHead className="w-32 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="text-xs">{it.descricao}</TableCell>
                  <TableCell><Input type="number" value={it.quantidade} onChange={e => updateItem(idx, "quantidade", Number(e.target.value))} /></TableCell>
                  <TableCell>{it.unidade_medida}</TableCell>
                  <TableCell><Input type="number" step="0.01" className="text-right" value={it.valor_unitario} onChange={e => updateItem(idx, "valor_unitario", Number(e.target.value))} /></TableCell>
                  <TableCell className="text-right">{fmtBRL(it.valor_total)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={5} className="text-right font-medium">Total geral</TableCell>
                <TableCell className="text-right font-semibold">{fmtBRL(valorTotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Textarea placeholder="Observações" value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />

          {order?.status === "aguardando_aprovacao" && canApprove && (
            <div className="border rounded-md p-3 space-y-2 bg-muted/40">
              <Label>Motivo (em caso de negação)</Label>
              <Textarea value={motivoNegacao} onChange={e => setMotivoNegacao(e.target.value)} rows={2} />
              <div className="flex gap-2">
                <Button className="rounded-full" disabled={saving} onClick={authorize}>Autorizar</Button>
                <Button variant="destructive" className="rounded-full" disabled={saving} onClick={deny}>Negar</Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button className="rounded-full" disabled={saving} onClick={saveDraft}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}