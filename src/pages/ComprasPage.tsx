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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import PurchaseRequisitionModal from "@/components/purchases/PurchaseRequisitionModal";
import PurchaseQuotationModal from "@/components/purchases/PurchaseQuotationModal";
import PurchaseOrderModal from "@/components/purchases/PurchaseOrderModal";
import PriceBankPanel from "@/components/purchases/PriceBankPanel";
import SupplierInviteModal from "@/components/purchases/SupplierInviteModal";
import PurchasesDashboardPanel from "@/components/purchases/PurchasesDashboardPanel";
import { PERIOD_LABEL, type PeriodKey } from "@/components/purchases/PurchasesDashboardPanel";
import OrderDossierModal from "@/components/purchases/OrderDossierModal";
import { generateRequisitionPdf } from "@/lib/requisitionPdf";
import { generateQuotationPdf } from "@/lib/quotationPdf";
import { generateOrderPdf } from "@/lib/orderPdf";

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
  const { profile, isAdmin } = useAuth();
  const [tab, setTab] = useState("requisicoes");

  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [reqItemsCount, setReqItemsCount] = useState<Record<string, number>>({});
  const [invitesByReq, setInvitesByReq] = useState<Record<string, { total: number; respondidos: number; firstToken?: string }>>({});

  const [unitFilter, setUnitFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [panelPeriod, setPanelPeriod] = useState<PeriodKey>("month");
  const [panelUnit, setPanelUnit] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [dossierOrderId, setDossierOrderId] = useState<string | null>(null);
  const [dossierOpen, setDossierOpen] = useState(false);

  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<any>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteContext, setQuoteContext] = useState<{ requisitionId?: string; quotationId?: string } | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderContext, setOrderContext] = useState<{ quotationId?: string; orderId?: string } | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteContext, setInviteContext] = useState<{ requisitionId: string; numero: string; facilityUnit?: string } | null>(null);

  const loadAll = async () => {
    const [reqRes, quoteRes, ordRes, contractRes, itemsRes, invitesRes] = await Promise.all([
      supabase.from("purchase_requisitions").select("*").order("created_at", { ascending: false }),
      supabase.from("purchase_quotations").select("*").order("created_at", { ascending: false }),
      supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("contracts").select("*"),
      supabase.from("purchase_requisition_items").select("requisition_id"),
      (supabase as any).from("quotation_invites").select("requisition_id, token, status, submitted_at").order("created_at", { ascending: true }),
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
    const inv: Record<string, { total: number; respondidos: number; firstToken?: string }> = {};
    (invitesRes?.data || []).forEach((i: any) => {
      const cur = inv[i.requisition_id] || { total: 0, respondidos: 0, firstToken: undefined };
      cur.total += 1;
      if (i.submitted_at || i.status === "respondido") cur.respondidos += 1;
      if (!cur.firstToken) cur.firstToken = i.token;
      inv[i.requisition_id] = cur;
    });
    setInvitesByReq(inv);
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
      if (dateRange?.from || dateRange?.to) {
        const d = r.data_requisicao ? new Date(r.data_requisicao) : (r.created_at ? new Date(r.created_at) : null);
        if (!d) return false;
        if (dateRange.from && d < dateRange.from) return false;
        if (dateRange.to && d > new Date(dateRange.to.getTime() + 86400000 - 1)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.numero, r.setor, r.solicitante_nome].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requisitions, search, unitFilter, statusFilter, dateRange]);

  const filteredQuotes = useMemo(() => {
    return quotations.filter(q => {
      if (unitFilter !== "all" && q.facility_unit !== unitFilter) return false;
      if (dateRange?.from || dateRange?.to) {
        const d = q.data_cotacao ? new Date(q.data_cotacao) : (q.created_at ? new Date(q.created_at) : null);
        if (!d) return false;
        if (dateRange.from && d < dateRange.from) return false;
        if (dateRange.to && d > new Date(dateRange.to.getTime() + 86400000 - 1)) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const hay = [q.numero, q.winner_supplier, q.setor_comprador].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [quotations, search, unitFilter, dateRange]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (unitFilter !== "all" && o.facility_unit !== unitFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (dateRange?.from || dateRange?.to) {
        const d = o.created_at ? new Date(o.created_at) : null;
        if (!d) return false;
        if (dateRange.from && d < dateRange.from) return false;
        if (dateRange.to && d > new Date(dateRange.to.getTime() + 86400000 - 1)) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const hay = [o.numero, o.fornecedor_nome, o.rubrica_name].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [orders, search, unitFilter, statusFilter, dateRange]);

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
  const openInvite = (r: any) => { setInviteContext({ requisitionId: r.id, numero: r.numero, facilityUnit: r.facility_unit }); setInviteModalOpen(true); };

  const handleDeleteRequisition = async (r: any) => {
    if (!confirm(`Excluir requisição ${r.numero}? Esta ação não pode ser desfeita.`)) return;
    // Apaga itens primeiro (sem FK cascade declarada)
    await (supabase as any).from("purchase_requisition_items").delete().eq("requisition_id", r.id);
    const { error } = await supabase.from("purchase_requisitions").delete().eq("id", r.id);
    if (error) { toast.error("Sem permissão para excluir requisição"); return; }
    toast.success("Requisição excluída");
    loadAll();
  };

  const handleDeleteQuotation = async (q: any) => {
    if (!confirm(`Excluir cotação ${q.numero}? Esta ação não pode ser desfeita.`)) return;
    await (supabase as any).from("purchase_quotation_prices").delete().eq("quotation_id", q.id);
    await (supabase as any).from("purchase_quotation_suppliers").delete().eq("quotation_id", q.id);
    const { error } = await supabase.from("purchase_quotations").delete().eq("id", q.id);
    if (error) { toast.error("Sem permissão para excluir cotação"); return; }
    toast.success("Cotação excluída");
    loadAll();
  };

  const handleDeleteOrder = async (o: any) => {
    if (!confirm(`Excluir ordem de compra ${o.numero}? Esta ação não pode ser desfeita.`)) return;
    await (supabase as any).from("purchase_order_items").delete().eq("purchase_order_id", o.id);
    await (supabase as any).from("purchase_order_approvals").delete().eq("purchase_order_id", o.id);
    const { error } = await supabase.from("purchase_orders").delete().eq("id", o.id);
    if (error) { toast.error("Sem permissão para excluir ordem de compra"); return; }
    toast.success("Ordem de compra excluída");
    loadAll();
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <PageHeader title="Compras" />
          <Button className="rounded-full" onClick={openNewRequisition}>Nova requisição</Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <TabsList className="inline-flex w-auto h-auto flex-wrap shrink-0">
              <TabsTrigger value="requisicoes">Requisições</TabsTrigger>
              <TabsTrigger value="cotacoes">Cotações</TabsTrigger>
              <TabsTrigger value="ordens">Ordens de Compra</TabsTrigger>
              <TabsTrigger value="banco">Banco de Preços</TabsTrigger>
              <TabsTrigger value="painel">Painel</TabsTrigger>
            </TabsList>
            {tab !== "painel" && (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-end">
                <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full xl:max-w-[260px]" />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full xl:w-[240px] justify-start text-left font-normal rounded-md",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "dd/MM/yy", { locale: ptBR })} – {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}</>
                        ) : (
                          format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        )
                      ) : (
                        <span>Período</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <div className="flex flex-wrap gap-1 p-2 border-b">
                      <Button size="sm" variant="ghost" className="rounded-full text-xs h-7" onClick={() => {
                        const t = new Date(); setDateRange({ from: t, to: t });
                      }}>Hoje</Button>
                      <Button size="sm" variant="ghost" className="rounded-full text-xs h-7" onClick={() => {
                        const t = new Date(); const f = new Date(); f.setDate(f.getDate() - 6);
                        setDateRange({ from: f, to: t });
                      }}>Últimos 7 dias</Button>
                      <Button size="sm" variant="ghost" className="rounded-full text-xs h-7" onClick={() => {
                        const t = new Date(); const f = new Date(t.getFullYear(), t.getMonth(), 1);
                        setDateRange({ from: f, to: t });
                      }}>Mês atual</Button>
                      <Button size="sm" variant="ghost" className="rounded-full text-xs h-7" onClick={() => setDateRange(undefined)}>Limpar</Button>
                    </div>
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Select value={unitFilter} onValueChange={setUnitFilter}>
                  <SelectTrigger className="w-full xl:w-[210px]"><SelectValue placeholder="Unidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as unidades</SelectItem>
                    {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(tab === "requisicoes" || tab === "ordens") && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full xl:w-[210px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {tab === "requisicoes"
                        ? Object.entries(REQ_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)
                        : Object.entries(OC_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            {tab === "painel" && (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-end">
                <Select value={panelPeriod} onValueChange={(v) => setPanelPeriod(v as PeriodKey)}>
                  <SelectTrigger className="w-full xl:w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map(k =>
                      <SelectItem key={k} value={k}>{PERIOD_LABEL[k]}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Select value={panelUnit} onValueChange={setPanelUnit}>
                  <SelectTrigger className="w-full xl:w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as unidades</SelectItem>
                    {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
                            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => openInvite(r)}>Convidar</Button>
                            <Button size="sm" className="rounded-full" onClick={() => openCreateQuote(r.id)}>Cotar</Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={async () => {
                                try {
                                  await generateRequisitionPdf(r.id);
                                  toast.success("PDF gerado");
                                } catch (e: any) {
                                  toast.error(e?.message || "Erro ao gerar PDF");
                                }
                              }}
                            >
                              PDF
                            </Button>
                            {isAdmin && (
                              <Button size="sm" variant="destructive" className="rounded-full" onClick={() => handleDeleteRequisition(r)}>Excluir</Button>
                            )}
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
                      <TableHead>Requisição</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Setor comprador</TableHead>
                      <TableHead>Fornecedor campeão</TableHead>
                      <TableHead className="text-right">Total campeão</TableHead>
                      <TableHead className="text-center">Rastreio</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotes.map(q => {
                      const req = requisitions.find(r => r.id === q.requisition_id);
                      const inv = invitesByReq[q.requisition_id] || { total: 0, respondidos: 0 };
                      const trackingUrl = inv.firstToken ? `${window.location.origin}/cotacao-publica/${inv.firstToken}` : null;
                      const copyTracking = async () => {
                        if (!trackingUrl) return;
                        try {
                          await navigator.clipboard.writeText(trackingUrl);
                          toast.success("Link de rastreio copiado");
                        } catch {
                          toast.error("Não foi possível copiar");
                        }
                      };
                      return (
                        <TableRow key={q.id}>
                          <TableCell className="font-mono text-xs">{q.numero}</TableCell>
                          <TableCell className="font-mono text-xs">{req?.numero || "—"}</TableCell>
                          <TableCell>{q.data_cotacao ? new Date(q.data_cotacao).toLocaleDateString("pt-BR") : "-"}</TableCell>
                          <TableCell>{q.facility_unit}</TableCell>
                          <TableCell>{q.setor_comprador || "-"}</TableCell>
                          <TableCell>{q.winner_supplier || "—"}</TableCell>
                          <TableCell className="text-right">{fmtBRL(Number(q.total_winner))}</TableCell>
                          <TableCell className="text-center">
                            {req && (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-full px-3 text-xs"
                                  onClick={() => openInvite(req)}
                                >
                                  Convites
                                </Button>
                                {trackingUrl && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 rounded-full px-3 text-xs"
                                    onClick={copyTracking}
                                  >
                                    Copiar link
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className="w-fit">{q.status}</Badge>
                              <span className="text-[11px] text-muted-foreground">
                                {inv.respondidos} de {inv.total} respostas
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEditQuote(q.id)}>Abrir</Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                onClick={async () => {
                                  try {
                                    await generateQuotationPdf(q.id);
                                    toast.success("PDF da cotação gerado");
                                  } catch (e: any) {
                                    toast.error(e?.message || "Falha ao gerar PDF");
                                  }
                                }}
                              >
                                PDF
                              </Button>
                              <Button size="sm" className="rounded-full" onClick={() => openCreateOrder(q.id)}>Gerar OC</Button>
                              {isAdmin && (
                                <Button size="sm" variant="destructive" className="rounded-full" onClick={() => handleDeleteQuotation(q)}>Excluir</Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredQuotes.length === 0 && (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma cotação encontrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="banco" className="mt-4">
            <PriceBankPanel externalSearch={search} externalUnit={unitFilter} />
          </TabsContent>

          <TabsContent value="ordens" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Ordens de compra</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Requisição</TableHead>
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
                      const req = requisitions.find(r => r.id === o.requisition_id);
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs">{o.numero}</TableCell>
                          <TableCell className="font-mono text-xs">{req?.numero || "—"}</TableCell>
                          <TableCell>{o.facility_unit}</TableCell>
                          <TableCell>{o.fornecedor_nome}</TableCell>
                          <TableCell className="text-xs">{contract?.name || "—"}</TableCell>
                          <TableCell>{o.rubrica_name || "—"}</TableCell>
                          <TableCell className="text-right">{fmtBRL(Number(o.valor_total))}</TableCell>
                          <TableCell><Badge variant="outline">{OC_STATUS_LABEL[o.status] || o.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                onClick={async () => {
                                  try {
                                    await generateOrderPdf(o.id);
                                    toast.success("PDF da ordem de compra gerado");
                                  } catch (e: any) {
                                    toast.error(e?.message || "Falha ao gerar PDF");
                                  }
                                }}
                              >
                                PDF
                              </Button>
                              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEditOrder(o.id)}>Abrir</Button>
                              <Button size="sm" variant="secondary" className="rounded-full" onClick={() => { setDossierOrderId(o.id); setDossierOpen(true); }}>Dossiê</Button>
                              {isAdmin && (
                                <Button size="sm" variant="destructive" className="rounded-full" onClick={() => handleDeleteOrder(o)}>Excluir</Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredOrders.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma ordem encontrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="painel" className="mt-4">
            <PurchasesDashboardPanel
              requisitions={requisitions}
              quotations={quotations}
              orders={orders}
              contracts={contracts}
              invitesByReq={invitesByReq}
              period={panelPeriod}
              onPeriodChange={setPanelPeriod}
              unit={panelUnit}
              onUnitChange={setPanelUnit}
              hideFilters
            />
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
      <SupplierInviteModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        requisitionId={inviteContext?.requisitionId || null}
        requisitionNumero={inviteContext?.numero}
        facilityUnit={inviteContext?.facilityUnit}
      />
      <OrderDossierModal
        open={dossierOpen}
        onOpenChange={setDossierOpen}
        orderId={dossierOrderId}
      />
    </div>
  );
}