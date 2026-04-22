import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

interface Supplier {
  id?: string;
  slot: string;
  fornecedor_nome: string;
  fornecedor_cnpj?: string;
  prazo_entrega?: string;
  condicao_pagamento?: string;
  fonte: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requisitionId?: string;
  quotationId?: string;
  onSaved: () => void;
}

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function PurchaseQuotationModal({ open, onOpenChange, requisitionId, quotationId, onSaved }: Props) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [requisition, setRequisition] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  // prices[itemId][supplierIdx] = unit price
  const [prices, setPrices] = useState<Record<string, Record<number, number>>>({});
  const [setorComprador, setSetorComprador] = useState("");
  const [quotation, setQuotation] = useState<any>(null);
  const [sectorOptions, setSectorOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !requisition?.facility_unit) return;
    supabase.from("sectors").select("name").eq("facility_unit", requisition.facility_unit).order("name").then(({ data }) => {
      setSectorOptions((data || []).map((s: any) => s.name));
    });
  }, [open, requisition?.facility_unit]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      let reqId = requisitionId;
      let q: any = null;
      if (quotationId) {
        const { data: qd } = await supabase.from("purchase_quotations").select("*").eq("id", quotationId).single();
        q = qd;
        reqId = qd?.requisition_id;
      } else if (reqId) {
        // Auto-detect: se já existe uma cotação para esta requisição (gerada por convite, etc.), abre ela
        const { data: existing } = await supabase
          .from("purchase_quotations")
          .select("*")
          .eq("requisition_id", reqId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing) q = existing;
      }
      setQuotation(q);
      if (!reqId) return;
      const { data: r } = await supabase.from("purchase_requisitions").select("*").eq("id", reqId).single();
      setRequisition(r);
      setSetorComprador(q?.setor_comprador || r?.setor || "");
      const { data: itemsData } = await supabase.from("purchase_requisition_items").select("*").eq("requisition_id", reqId).order("item_num");
      setItems(itemsData || []);

      if (q) {
        const { data: sups } = await supabase
          .from("purchase_quotation_suppliers")
          .select("*")
          .eq("quotation_id", q.id)
          .order("created_at", { ascending: true });
        const supList: Supplier[] = (sups || []).map((s: any) => ({
          id: s.id, slot: s.slot, fornecedor_nome: s.fornecedor_nome,
          fornecedor_cnpj: s.fornecedor_cnpj, prazo_entrega: s.prazo_entrega,
          condicao_pagamento: s.condicao_pagamento, fonte: s.fonte
        }));
        // Garante mínimo de 3 slots para preenchimento manual
        while (supList.length < 3) supList.push({ slot: String(supList.length + 1), fornecedor_nome: "", fonte: "manual" });
        setSuppliers(supList);
        const { data: pr } = await supabase.from("purchase_quotation_prices").select("*").eq("quotation_id", q.id);
        const priceMap: Record<string, Record<number, number>> = {};
        (pr || []).forEach((p: any) => {
          const idx = supList.findIndex(s => s.id === p.supplier_id);
          if (idx === -1) return;
          if (!priceMap[p.requisition_item_id]) priceMap[p.requisition_item_id] = {};
          priceMap[p.requisition_item_id][idx] = Number(p.valor_unitario);
        });
        setPrices(priceMap);
      } else {
        setSuppliers([
          { slot: "1", fornecedor_nome: "", fonte: "manual" },
          { slot: "2", fornecedor_nome: "", fonte: "manual" },
          { slot: "3", fornecedor_nome: "", fonte: "manual" },
        ]);
        setPrices({});
      }
    };
    load();
  }, [open, requisitionId, quotationId]);

  const updateSupplier = (idx: number, field: keyof Supplier, value: any) => {
    setSuppliers(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const addSupplier = () => {
    setSuppliers(prev => [...prev, { slot: String(prev.length + 1), fornecedor_nome: "", fonte: "manual" }]);
  };

  const removeSupplier = (idx: number) => {
    setSuppliers(prev => prev.filter((_, i) => i !== idx));
    setPrices(prev => {
      const next: Record<string, Record<number, number>> = {};
      Object.keys(prev).forEach(itemId => {
        const row = prev[itemId];
        const newRow: Record<number, number> = {};
        Object.keys(row).forEach(k => {
          const i = Number(k);
          if (i === idx) return;
          newRow[i > idx ? i - 1 : i] = row[i];
        });
        next[itemId] = newRow;
      });
      return next;
    });
  };

  const setPrice = (itemId: string, supIdx: number, value: number) => {
    setPrices(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [supIdx]: value } }));
  };

  // Compute winner per item and total per supplier
  const totals: number[] = suppliers.map((_, supIdx) =>
    items.reduce((sum, it) => sum + (Number(prices[it.id]?.[supIdx] || 0) * Number(it.quantidade)), 0)
  );
  const winnerIdx = totals.length ? totals.reduce((best, val, i) => (val > 0 && (totals[best] === 0 || val < totals[best]) ? i : best), 0) : -1;
  // Ranking top-3 (1º, 2º, 3º) por menor total > 0
  const rankedIdxs: number[] = suppliers
    .map((_, i) => ({ i, total: totals[i] || 0 }))
    .filter(x => x.total > 0)
    .sort((a, b) => a.total - b.total)
    .slice(0, 3)
    .map(x => x.i);
  const rankOf = (idx: number): 1 | 2 | 3 | null => {
    const pos = rankedIdxs.indexOf(idx);
    return pos === -1 ? null : ((pos + 1) as 1 | 2 | 3);
  };
  const itemWinner = (itemId: string): number => {
    const row = prices[itemId] || {};
    let best = -1; let bestVal = Infinity;
    suppliers.forEach((_, i) => {
      const v = Number(row[i] || 0);
      if (v > 0 && v < bestVal) { bestVal = v; best = i; }
    });
    return best;
  };

  const generateNumero = () => {
    const year = new Date().getFullYear();
    return `COT/${Math.floor(Math.random() * 999).toString().padStart(3, "0")}/${year}`;
  };

  const handleSave = async () => {
    if (!profile || !requisition) return;
    const validSups = suppliers.filter(s => s.fornecedor_nome.trim());
    if (validSups.length === 0) { toast.error("Adicione pelo menos um fornecedor"); return; }
    setSaving(true);
    try {
      let qId = quotation?.id;
      const payload = {
        requisition_id: requisition.id,
        facility_unit: requisition.facility_unit,
        setor_comprador: setorComprador || null,
        winner_supplier: winnerIdx >= 0 ? suppliers[winnerIdx]?.fornecedor_nome : null,
        total_winner: winnerIdx >= 0 ? totals[winnerIdx] : 0,
        status: "concluida" as const,
      };
      if (qId) {
        await supabase.from("purchase_quotations").update(payload).eq("id", qId);
        await supabase.from("purchase_quotation_prices").delete().eq("quotation_id", qId);
        await supabase.from("purchase_quotation_suppliers").delete().eq("quotation_id", qId);
      } else {
        const { data, error } = await supabase.from("purchase_quotations").insert({
          ...payload, numero: generateNumero(), created_by: profile.id,
        }).select().single();
        if (error) throw error;
        qId = data.id;
      }

      // Insert suppliers
      const supInsert = suppliers.map((s, i) => ({
        quotation_id: qId, slot: String(i + 1),
        fornecedor_nome: s.fornecedor_nome || `Fornecedor ${i + 1}`,
        fornecedor_cnpj: s.fornecedor_cnpj || null,
        prazo_entrega: s.prazo_entrega || null,
        condicao_pagamento: s.condicao_pagamento || null,
        fonte: s.fonte || "manual",
        total: totals[i] || 0,
      }));
      const { data: insertedSups, error: e2 } = await supabase.from("purchase_quotation_suppliers").insert(supInsert).select();
      if (e2) throw e2;

      // Insert prices
      const priceRows: any[] = [];
      items.forEach(it => {
        suppliers.forEach((_, i) => {
          const v = Number(prices[it.id]?.[i] || 0);
          if (v > 0) {
            priceRows.push({
              quotation_id: qId,
              requisition_item_id: it.id,
              supplier_id: insertedSups![i].id,
              valor_unitario: v,
              valor_total: v * Number(it.quantidade),
              is_winner: itemWinner(it.id) === i,
            });
          }
        });
      });
      if (priceRows.length) {
        const { error: e3 } = await supabase.from("purchase_quotation_prices").insert(priceRows);
        if (e3) throw e3;
      }

      // Save to price_history
      const histRows: any[] = [];
      // Resolve supplier_id por CNPJ (cria/atualiza cadastro de fornecedor)
      const supplierIdBySlot: Record<number, string | null> = {};
      for (let i = 0; i < suppliers.length; i++) {
        const s = suppliers[i];
        if (s.fornecedor_cnpj && s.fornecedor_nome) {
          const { data: sid } = await supabase.rpc("upsert_supplier_from_cnpj", {
            _nome: s.fornecedor_nome,
            _cnpj: s.fornecedor_cnpj,
          });
          supplierIdBySlot[i] = (sid as string) || null;
        } else {
          supplierIdBySlot[i] = null;
        }
      }
      items.forEach(it => {
        suppliers.forEach((s, i) => {
          const v = Number(prices[it.id]?.[i] || 0);
          if (v > 0 && s.fornecedor_nome) {
            histRows.push({
              descricao_produto: it.descricao,
              unidade_medida: it.unidade_medida,
              valor_unitario: v,
              fornecedor_nome: s.fornecedor_nome,
              fornecedor_cnpj: s.fornecedor_cnpj || null,
              supplier_id: supplierIdBySlot[i],
              fonte: "cotacao",
              quotation_id: qId,
              created_by: profile.id,
            });
          }
        });
      });
      if (histRows.length) await supabase.from("price_history").insert(histRows);

      // Update requisition status
      await supabase.from("purchase_requisitions").update({ status: "cotacao_concluida" }).eq("id", requisition.id);

      await supabase.from("purchase_audit_log").insert({
        entity_type: "quotation", entity_id: qId,
        action: quotation ? "updated" : "created",
        changed_by: profile.id, changed_by_name: profile.name,
      });

      toast.success("Cotação salva");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar cotação");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Mapa de cotação{requisition ? ` — Req. ${requisition.numero}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            {suppliers.slice(0, 3).map((s, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2">
                <Label className="text-sm">Fornecedor {i + 1}</Label>
                <Input placeholder="Nome" value={s.fornecedor_nome} onChange={e => updateSupplier(i, "fornecedor_nome", e.target.value)} />
                <Input placeholder="CNPJ" value={s.fornecedor_cnpj || ""} onChange={e => updateSupplier(i, "fornecedor_cnpj", e.target.value)} />
                <Input placeholder="Prazo entrega" value={s.prazo_entrega || ""} onChange={e => updateSupplier(i, "prazo_entrega", e.target.value)} />
                <Input placeholder="Condição pagamento" value={s.condicao_pagamento || ""} onChange={e => updateSupplier(i, "condicao_pagamento", e.target.value)} />
                <div className="text-sm">Total: <span className="font-semibold">{fmtBRL(totals[i] || 0)}</span></div>
                {winnerIdx === i && totals[i] > 0 && <Badge>Campeão</Badge>}
              </div>
            ))}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="w-20">Qtd</TableHead>
                {suppliers.slice(0, 3).map((s, i) => <TableHead key={i} className="text-right">Forn. {i + 1} (R$)</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => {
                const w = itemWinner(it.id);
                return (
                  <TableRow key={it.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="text-xs">{it.descricao}</TableCell>
                    <TableCell>{it.quantidade} {it.unidade_medida}</TableCell>
                    {suppliers.slice(0, 3).map((_, i) => (
                      <TableCell key={i} className={`text-right ${w === i ? "bg-emerald-100 dark:bg-emerald-950" : ""}`}>
                        <Input
                          type="number" step="0.01"
                          value={prices[it.id]?.[i] || ""}
                          onChange={e => setPrice(it.id, i, Number(e.target.value))}
                          className="text-right"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sem itens</TableCell></TableRow>}
            </TableBody>
          </Table>

          {winnerIdx >= 0 && totals[winnerIdx] > 0 && (
            <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-sm">
              Fornecedor campeão: <strong>{suppliers[winnerIdx]?.fornecedor_nome}</strong> com total <strong>{fmtBRL(totals[winnerIdx])}</strong>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-full" disabled={saving} onClick={handleSave}>{saving ? "Salvando..." : "Salvar cotação"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}