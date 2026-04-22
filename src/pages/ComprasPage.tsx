import { useEffect, useState, useMemo } from "react";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import PurchaseRequisitionModal from "@/components/purchases/PurchaseRequisitionModal";
import PurchaseQuotationModal from "@/components/purchases/PurchaseQuotationModal";
import PurchaseOrderModal from "@/components/purchases/PurchaseOrderModal";
import PriceBankPanel from "@/components/purchases/PriceBankPanel";

const REQ_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_cotacao: "Aguardando cotação",
  em_cotacao: "Em cotação",
  cotacao_concluida: "Cotação concluída",
  em_oc: "Em ordem de compra",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

const OC_STATUS_LABEL: Record<string, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  autorizada: "Autorizada",
  negada: "Negada",
  enviada: "Enviada",
  recebida: "Recebida",
  cancelada: "Cancelada",
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function ComprasPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("requisicoes");

  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [reqItemsCount, setReqItemsCount] = useState<Record<string, number>>({});

  const [unitFilter, setUnitFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<any>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteContext, setQuoteContext] = useState<{ requisitionId?: string; quotationId?: string } | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderContext, setOrderContext] = useState<{ quotationId?: string; orderId?: string } | null>(null);

  const loadAll = async () => {
    const [reqRes, quoteRes, ordRes, contractRes, itemsRes] = await Promise.all([
      supabase.from("purchase_requisitions").select("*").order("created_at", { ascending: false }),
      supabase.from("purchase_quotations").select("*").order("created_at", { ascending: false }),
      supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("contracts").select("*"),
      supabase.from("purchase_requisition_items").select("requisition_id"),
    ]);
    if (reqRes.error || quoteRes.error || ordRes.error) {
      toast.error("Erro ao carregar dados de compras");
      return;
    }
    setRequisitions(reqRes.data || []);
    setQuotations(quoteRes.data || []);
    setOrders(ordRes.data || []);
    setContracts(contractRes.data || []);
    const counts: Record<string, number> = {};
    (itemsRes.data || []).forEach((i: any) => {
      counts[i.requisition_id] = (counts[i.requisition_id] || 0) + 1;
    });
    setReqItemsCount(counts);
  };

  useEffect(() => { loadAll(); }, []);

  const units = useMemo(() => {
    const set = new Set<string>(requisitions.map(r => r.facility_unit).filter(Boolean));
    return Array.from(set).sort();
  }, [requisitions]);

  const filteredReqs = useMemo(() => {
    return requisitions.filter(r => {
      if (unitFilter !== "all" && r.facility_unit !== unitFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.numero, r.setor, r.solicitante_nome].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requisitions, search, unitFilter, statusFilter]);

  const filteredQuotes = useMemo(() => {
    return quotations.filter(q => {
      if (unitFilter !== "all" && q.facility_unit !== unitFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [q.numero, q.winner_supplier, q.setor_comprador].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [quotations, search, unitFilter]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (unitFilter !== "all" && o.facility_unit !== unitFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [o.numero, o.fornecedor_nome, o.rubrica_name].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [orders, search, unitFilter, statusFilter]);

  const kpis = useMemo(() => {
    const reqsAbertas = requisitions.filter(r => ["rascunho","aguardando_cotacao","em_cotacao"].includes(r.status)).length;
    const cotPendentes = quotations.filter(q => q.status !== "concluida" && q.status !== "cancelada").length;
    const ocAguard = orders.filter(o => o.status === "aguardando_aprovacao").length;
    const totalAutorizado = orders.filter(o => o.status === "autorizada" || o.status === "enviada" || o.status === "recebida").reduce((s, o) => s + Number(o.valor_total || 0), 0);
    return { reqsAbertas, cotPendentes, ocAguard, totalAutorizado };
  }, [requisitions, quotations, orders]);

  const openNewRequisition = () => { setEditingReq(null); setReqModalOpen(true); };
  const openEditRequisition = (r: any) => { setEditingReq(r); setReqModalOpen(true); };
  const openCreateQuote = (requisitionId: string) => { setQuoteContext({ requisitionId }); setQuoteModalOpen(true); };
  const openEditQuote = (quotationId: string) => { setQuoteContext({ quotationId }); setQuoteModalOpen(true); };
  const openCreateOrder = (quotationId: string) => { setOrderContext({ quotationId }); setOrderModalOpen(true); };
  const openEditOrder = (orderId: string) => { setOrderContext({ orderId }); setOrderModalOpen(true); };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <PageHeader title="Compras" />
          <Button className="rounded-full" onClick={openNewRequisition}>Nova requisição</Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="inline-flex w-auto h-auto flex-wrap">
            <TabsTrigger value="requisicoes">Requisições</TabsTrigger>
            <TabsTrigger value="cotacoes">Cotações</TabsTrigger>
            <TabsTrigger value="banco">Banco de Preços</TabsTrigger>
            <TabsTrigger value="ordens">Ordens de Compra</TabsTrigger>
            <TabsTrigger value="painel">Painel</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-3 mt-4">
            <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            {(tab === "requisicoes" || tab === "ordens") && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {tab === "requisicoes"
                    ? Object.entries(REQ_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)
                    : Object.entries(OC_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <TabsContent value="requisicoes" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Requisições de compra</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Classificação</TableHead>
                      <TableHead className="text-right">Itens</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReqs.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                        <TableCell>{r.data_requisicao ? new Date(r.data_requisicao).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>{r.facility_unit}</TableCell>
                        <TableCell>{r.setor || "-"}</TableCell>
                        <TableCell>{r.solicitante_nome || "-"}</TableCell>
                        <TableCell className="text-xs">{(r.classificacao || []).join(", ")}</TableCell>
                        <TableCell className="text-right">{reqItemsCount[r.id] || 0}</TableCell>
                        <TableCell><Badge variant="outline">{REQ_STATUS_LABEL[r.status] || r.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEditRequisition(r)}>Abrir</Button>
                            <Button size="sm" className="rounded-full" onClick={() => openCreateQuote(r.id)}>Cotar</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredReqs.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma requisição encontrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cotacoes" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Mapas de cotação</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Setor comprador</TableHead>
                      <TableHead>Fornecedor campeão</TableHead>
                      <TableHead className="text-right">Total campeão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotes.map(q => (
                      <TableRow key={q.id}>
                        <TableCell className="font-mono text-xs">{q.numero}</TableCell>
                        <TableCell>{q.data_cotacao ? new Date(q.data_cotacao).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>{q.facility_unit}</TableCell>
                        <TableCell>{q.setor_comprador || "-"}</TableCell>
                        <TableCell>{q.winner_supplier || "—"}</TableCell>
                        <TableCell className="text-right">{fmtBRL(Number(q.total_winner))}</TableCell>
                        <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEditQuote(q.id)}>Abrir</Button>
                            <Button size="sm" className="rounded-full" onClick={() => openCreateOrder(q.id)}>Gerar OC</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredQuotes.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma cotação encontrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="banco" className="mt-4">
            <PriceBankPanel />
          </TabsContent>

          <TabsContent value="ordens" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Ordens de compra</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Rubrica</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map(o => {
                      const contract = contracts.find(c => c.id === o.contract_id);
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs">{o.numero}</TableCell>
                          <TableCell>{o.facility_unit}</TableCell>
                          <TableCell>{o.fornecedor_nome}</TableCell>
                          <TableCell className="text-xs">{contract?.name || "—"}</TableCell>
                          <TableCell>{o.rubrica_name || "—"}</TableCell>
                          <TableCell className="text-right">{fmtBRL(Number(o.valor_total))}</TableCell>
                          <TableCell><Badge variant="outline">{OC_STATUS_LABEL[o.status] || o.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEditOrder(o.id)}>Abrir</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredOrders.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma ordem encontrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="painel" className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Requisições abertas</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{kpis.reqsAbertas}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Cotações pendentes</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{kpis.cotPendentes}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">OCs aguardando aprovação</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{kpis.ocAguard}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total autorizado</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{fmtBRL(kpis.totalAutorizado)}</div></CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <PurchaseRequisitionModal
        open={reqModalOpen}
        onOpenChange={setReqModalOpen}
        requisition={editingReq}
        onSaved={() => { setReqModalOpen(false); loadAll(); }}
      />
      <PurchaseQuotationModal
        open={quoteModalOpen}
        onOpenChange={setQuoteModalOpen}
        requisitionId={quoteContext?.requisitionId}
        quotationId={quoteContext?.quotationId}
        onSaved={() => { setQuoteModalOpen(false); loadAll(); }}
      />
      <PurchaseOrderModal
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
        quotationId={orderContext?.quotationId}
        orderId={orderContext?.orderId}
        onSaved={() => { setOrderModalOpen(false); loadAll(); }}
      />
    </div>
  );
}