import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import ProductCatalogModal from "./ProductCatalogModal";
import SupplierRegistryModal from "./SupplierRegistryModal";
import { ChevronDown, ChevronRight } from "lucide-react";

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (d: string | Date | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtCnpj = (v: string | null | undefined) => {
  const s = (v || "").replace(/\D/g, "");
  if (s.length !== 14) return v || "—";
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
};

interface PriceBankPanelProps {
  externalSearch?: string;
  externalUnit?: string;
}

export default function PriceBankPanel({ externalSearch = "", externalUnit = "all" }: PriceBankPanelProps) {
  const { profile } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [searchAI, setSearchAI] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set());
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // Filtros vêm da página de Compras (acima das abas)
  const search = externalSearch;
  const unitFilter = externalUnit;

  const load = async () => {
    const { data } = await supabase.from("price_history").select("*").order("data_referencia", { ascending: false }).limit(500);
    setHistory(data || []);
    const { data: cat } = await supabase.from("product_catalog").select("*").eq("ativo", true).order("descricao");
    setCatalog(cat || []);
    const { data: sups } = await supabase.from("suppliers").select("*").order("nome");
    setSuppliers(sups || []);
    await loadPurchaseHistory();
  };

  const loadPurchaseHistory = async () => {
    // Pega itens das OCs com OC autorizada/enviada/recebida (compras efetivas)
    const { data: ords } = await supabase
      .from("purchase_orders")
      .select("id, numero, facility_unit, fornecedor_nome, status, data_envio_fornecedor, aprovado_em, created_at")
      .in("status", ["autorizada", "enviada", "recebida"]);
    if (!ords || ords.length === 0) { setPurchaseHistory([]); return; }
    const { data: items } = await supabase
      .from("purchase_order_items")
      .select("*")
      .in("purchase_order_id", ords.map(o => o.id));
    const ordById = new Map(ords.map(o => [o.id, o]));
    const rows = (items || []).map((it: any) => {
      const o = ordById.get(it.purchase_order_id);
      const dataCompra = o?.data_envio_fornecedor || o?.aprovado_em || o?.created_at;
      return {
        id: it.id,
        descricao: it.descricao,
        quantidade: Number(it.quantidade) || 0,
        unidade_medida: it.unidade_medida,
        valor_unitario: Number(it.valor_unitario) || 0,
        valor_total: Number(it.valor_total) || 0,
        facility_unit: o?.facility_unit || "—",
        fornecedor_nome: o?.fornecedor_nome || "—",
        oc_numero: o?.numero || "—",
        data_compra: dataCompra,
      };
    });
    setPurchaseHistory(rows);
  };

  useEffect(() => { load(); }, []);

  // Filtro de período → data mínima
  const minDate: Date | null = (() => {
    const days = periodFilter === "30" ? 30 : periodFilter === "90" ? 90 : periodFilter === "180" ? 180 : null;
    if (!days) return null;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  })();

  const filtered = history.filter(h => {
    if (search) {
      const normalize = (s: string) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const q = normalize(search);
      const hay = normalize([h.descricao_produto, h.fornecedor_nome, h.categoria, h.fonte].filter(Boolean).join(" "));
      if (!hay.includes(q)) return false;
    }
    if (supplierFilter !== "all") {
      if (h.supplier_id !== supplierFilter) return false;
    }
    if (minDate && h.data_referencia && new Date(h.data_referencia) < minDate) return false;
    return true;
  });

  const selectedSupplier = supplierFilter !== "all" ? suppliers.find(s => s.id === supplierFilter) : null;

  // Agrupa preços do fornecedor selecionado por descrição (para visão dedicada)
  const supplierProductHistory = (() => {
    if (!selectedSupplier) return [] as any[];
    const groups = new Map<string, any[]>();
    filtered.forEach(h => {
      const key = (h.descricao_produto || "").trim().toLowerCase();
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(h);
    });
    const out: any[] = [];
    groups.forEach((arr, key) => {
      const sorted = [...arr].sort((a, b) => new Date(b.data_referencia).getTime() - new Date(a.data_referencia).getTime());
      const atual = sorted[0];
      const anterior = sorted[1];
      const variacao = anterior && anterior.valor_unitario > 0
        ? ((Number(atual.valor_unitario) - Number(anterior.valor_unitario)) / Number(anterior.valor_unitario)) * 100
        : null;
      out.push({
        key,
        descricao: atual.descricao_produto,
        unidade_medida: atual.unidade_medida || "UN",
        ultimaData: atual.data_referencia,
        precoAtual: Number(atual.valor_unitario),
        variacao,
        cotacoes: sorted.length,
        timeline: sorted,
      });
    });
    return out.sort((a, b) => new Date(b.ultimaData).getTime() - new Date(a.ultimaData).getTime());
  })();

  const supplierStats = (() => {
    if (!selectedSupplier) return null;
    const total = filtered.length;
    const ultimoPreco = filtered[0];
    const itensUnicos = new Set(filtered.map(h => (h.descricao_produto || "").trim().toLowerCase())).size;
    return { total, ultimoPreco, itensUnicos };
  })();

  const filteredCatalog = catalog.filter(c => {
    if (unitFilter !== "all" && c.facility_unit && c.facility_unit !== unitFilter) return false;
    if (search) {
      const normalize = (s: string) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const q = normalize(search);
      const hay = normalize([c.codigo, c.descricao, c.tipo, c.classificacao, c.facility_unit, c.setor, c.categoria_opme].filter(Boolean).join(" "));
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Agrupa histórico por unidade + descrição para calcular curva de consumo
  const consumoCurva = (() => {
    const groups = new Map<string, any[]>();
    purchaseHistory.forEach(p => {
      if (unitFilter !== "all" && p.facility_unit !== unitFilter) return;
      if (search) {
        const q = search.toLowerCase();
        const hay = [p.descricao, p.fornecedor_nome, p.oc_numero].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return;
      }
      const key = `${p.facility_unit}||${(p.descricao || "").trim().toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    });
    const today = new Date();
    const out: any[] = [];
    groups.forEach((arr, key) => {
      const sorted = arr
        .filter(x => x.data_compra)
        .sort((a, b) => new Date(a.data_compra).getTime() - new Date(b.data_compra).getTime());
      const totalQtd = arr.reduce((s, x) => s + x.quantidade, 0);
      const totalValor = arr.reduce((s, x) => s + x.valor_total, 0);
      const ultima = sorted[sorted.length - 1];
      const primeira = sorted[0];
      let intervaloMedioDias: number | null = null;
      if (sorted.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          const diff = (new Date(sorted[i].data_compra).getTime() - new Date(sorted[i - 1].data_compra).getTime()) / (1000 * 60 * 60 * 24);
          intervals.push(diff);
        }
        intervaloMedioDias = intervals.reduce((s, n) => s + n, 0) / intervals.length;
      }
      const diasDesdeUltima = ultima?.data_compra ? Math.floor((today.getTime() - new Date(ultima.data_compra).getTime()) / (1000 * 60 * 60 * 24)) : null;
      const proximaCompraSugerida = ultima?.data_compra && intervaloMedioDias
        ? new Date(new Date(ultima.data_compra).getTime() + intervaloMedioDias * 24 * 60 * 60 * 1000)
        : null;
      const consumoMensal = intervaloMedioDias && intervaloMedioDias > 0
        ? (totalQtd / sorted.length) * (30 / intervaloMedioDias)
        : null;
      out.push({
        key,
        descricao: arr[0].descricao,
        facility_unit: arr[0].facility_unit,
        unidade_medida: arr[0].unidade_medida,
        compras: sorted.length,
        totalQtd,
        totalValor,
        ultimoFornecedor: ultima?.fornecedor_nome,
        ultimaData: ultima?.data_compra,
        primeiraData: primeira?.data_compra,
        intervaloMedioDias,
        diasDesdeUltima,
        proximaCompraSugerida,
        consumoMensal,
        ultimoPreco: ultima?.valor_unitario,
      });
    });
    return out.sort((a, b) => (b.totalValor || 0) - (a.totalValor || 0));
  })();

  const purchaseUnits = Array.from(new Set(purchaseHistory.map(p => p.facility_unit).filter(Boolean))).sort();

  const runAISearch = async () => {
    if (!searchAI.trim() || !profile) return;
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("price-search", { body: { descricao: searchAI } });
      if (error) throw error;
      const results = data?.results || [];
      if (!results.length) { toast.warning("Nenhum preço encontrado pela IA"); return; }
      const rows = results.map((r: any) => ({
        descricao_produto: searchAI,
        valor_unitario: Number(r.preco) || 0,
        fornecedor_nome: r.fornecedor || "Indefinido",
        fonte_url: r.fonte_url || null,
        fonte: "ia",
        created_by: profile.id,
      }));
      await supabase.from("price_history").insert(rows);
      toast.success(`${rows.length} preço(s) encontrado(s) pela IA e salvos`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro na busca");
    } finally { setLoadingAI(false); }
  };

  const deleteOne = async (id: string) => {
    if (!confirm("Apagar este preço do histórico?")) return;
    const { error } = await supabase.from("price_history").delete().eq("id", id);
    if (error) { toast.error("Erro ao apagar"); return; }
    setSelectedHistory(prev => { const n = new Set(prev); n.delete(id); return n; });
    toast.success("Preço removido");
    load();
  };

  const deleteSelected = async () => {
    if (selectedHistory.size === 0) return;
    if (!confirm(`Apagar ${selectedHistory.size} preço(s) selecionado(s)?`)) return;
    const ids = Array.from(selectedHistory);
    const { error } = await supabase.from("price_history").delete().in("id", ids);
    if (error) { toast.error("Erro ao apagar"); return; }
    setSelectedHistory(new Set());
    toast.success(`${ids.length} preço(s) removido(s)`);
    load();
  };

  const toggleSelect = (id: string) => {
    setSelectedHistory(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedHistory.size === filtered.length) setSelectedHistory(new Set());
    else setSelectedHistory(new Set(filtered.map(h => h.id)));
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="catalogo" className="w-full">
        <TabsList className="inline-flex w-auto h-auto">
          <TabsTrigger value="catalogo">Cadastro de itens</TabsTrigger>
          <TabsTrigger value="historico">Histórico de preços</TabsTrigger>
          <TabsTrigger value="compras">Histórico de compras</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="mt-4">
          <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Catálogo de itens</CardTitle>
          <Button size="sm" className="rounded-full" onClick={() => { setEditingProduct(null); setCatalogModalOpen(true); }}>Cadastrar item</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead className="w-20">Tipo</TableHead>
                <TableHead className="w-32">Classificação</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-32">Unidade</TableHead>
                <TableHead className="w-32">Setor</TableHead>
                <TableHead className="w-16">Un</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCatalog.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                  <TableCell>{c.tipo}</TableCell>
                  <TableCell className="capitalize">{c.classificacao}</TableCell>
                  <TableCell className="text-xs">{c.descricao}</TableCell>
                  <TableCell className="text-xs">{c.facility_unit || "—"}</TableCell>
                  <TableCell className="text-xs">{c.setor || "—"}</TableCell>
                  <TableCell>{c.unidade_medida}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full px-3"
                        onClick={() => { setEditingProduct(c); setCatalogModalOpen(true); }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 rounded-full px-3"
                        onClick={async () => {
                          if (!confirm(`Excluir item "${c.descricao}"?`)) return;
                          const { error } = await supabase.from("product_catalog").update({ ativo: false }).eq("id", c.id);
                          if (error) { toast.error(error.message); return; }
                          toast.success("Item removido");
                          load();
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCatalog.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum item no catálogo</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-4">
          <Card>
        <CardHeader>
          <CardTitle className="text-base">Pesquisa inteligente de preços</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">A IA pesquisa em fabricantes, distribuidores hospitalares e portais oficiais (Bionexo, BPS/MS) e traz preço, fornecedor e link da fonte.</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Ex: Soro fisiológico 0,9% 500ml" value={searchAI} onChange={e => setSearchAI(e.target.value)} onKeyDown={e => e.key === "Enter" && runAISearch()} />
            <Button className="rounded-full" disabled={loadingAI} onClick={runAISearch}>{loadingAI ? "Pesquisando..." : "Pesquisa"}</Button>
          </div>
        </CardContent>
          </Card>

          <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Histórico de preços</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={supplierFilter} onValueChange={(v) => { setSupplierFilter(v); setExpandedProduct(null); }}>
                <SelectTrigger className="h-8 w-[240px] rounded-full text-xs"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os fornecedores</SelectItem>
                  {suppliers.filter(s => s.ativo).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nome} — {fmtCnpj(s.cnpj)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="h-8 w-[140px] rounded-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo período</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="180">Últimos 180 dias</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => setSupplierModalOpen(true)}>
                Gerenciar fornecedores
              </Button>
              {selectedHistory.size > 0 && (
                <Button size="sm" variant="destructive" className="rounded-full" onClick={deleteSelected}>
                  Apagar selecionados ({selectedHistory.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedSupplier ? (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/30">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-lg font-semibold">{selectedSupplier.nome}</div>
                    <div className="text-xs text-muted-foreground font-mono">{fmtCnpj(selectedSupplier.cnpj)}</div>
                    {(selectedSupplier.contato_responsavel || selectedSupplier.email || selectedSupplier.telefone) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {[selectedSupplier.contato_responsavel, selectedSupplier.email, selectedSupplier.telefone].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div><div className="text-xs text-muted-foreground">Itens cotados</div><div className="font-semibold">{supplierStats?.itensUnicos || 0}</div></div>
                    <div><div className="text-xs text-muted-foreground">Total de cotações</div><div className="font-semibold">{supplierStats?.total || 0}</div></div>
                    <div><div className="text-xs text-muted-foreground">Última cotação</div><div className="font-semibold">{supplierStats?.ultimoPreco ? fmtDate(supplierStats.ultimoPreco.data_referencia) : "—"}</div></div>
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Última cotação</TableHead>
                    <TableHead className="text-right">Preço atual</TableHead>
                    <TableHead className="text-right">Variação</TableHead>
                    <TableHead className="text-right">Nº cotações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierProductHistory.map(p => {
                    const expanded = expandedProduct === p.key;
                    const varColor = p.variacao == null ? "" : p.variacao > 0 ? "text-destructive" : p.variacao < 0 ? "text-emerald-600" : "";
                    return (
                      <>
                        <TableRow key={p.key} className="cursor-pointer" onClick={() => setExpandedProduct(expanded ? null : p.key)}>
                          <TableCell>{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</TableCell>
                          <TableCell className="text-xs">{p.descricao}</TableCell>
                          <TableCell className="text-xs">{fmtDate(p.ultimaData)}</TableCell>
                          <TableCell className="text-right font-medium">{fmtBRL(p.precoAtual)}</TableCell>
                          <TableCell className={`text-right text-xs font-medium ${varColor}`}>
                            {p.variacao == null ? "—" : `${p.variacao > 0 ? "+" : ""}${p.variacao.toFixed(1)}%`}
                          </TableCell>
                          <TableCell className="text-right">{p.cotacoes}</TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow key={`${p.key}-tl`}>
                            <TableCell colSpan={6} className="bg-muted/20">
                              <div className="px-4 py-2">
                                <div className="text-xs font-medium text-muted-foreground mb-2">Linha do tempo</div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Data</TableHead>
                                      <TableHead className="text-right">Preço unitário</TableHead>
                                      <TableHead>Unidade</TableHead>
                                      <TableHead>Fonte</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {p.timeline.map((t: any) => (
                                      <TableRow key={t.id}>
                                        <TableCell className="text-xs">{fmtDate(t.data_referencia)}</TableCell>
                                        <TableCell className="text-right">{fmtBRL(Number(t.valor_unitario))}</TableCell>
                                        <TableCell className="text-xs">{t.unidade_medida || "UN"}</TableCell>
                                        <TableCell><Badge variant="outline" className="text-xs">{t.fonte}</Badge></TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                  {supplierProductHistory.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum preço deste fornecedor no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={filtered.length > 0 && selectedHistory.size === filtered.length} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Un</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead className="w-16 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(h => (
                <TableRow key={h.id}>
                  <TableCell>
                    <Checkbox checked={selectedHistory.has(h.id)} onCheckedChange={() => toggleSelect(h.id)} />
                  </TableCell>
                  <TableCell>{new Date(h.data_referencia).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-xs">{h.descricao_produto}</TableCell>
                  <TableCell>{h.fornecedor_nome || "—"}</TableCell>
                  <TableCell>{h.unidade_medida || "UN"}</TableCell>
                  <TableCell className="text-right">{fmtBRL(Number(h.valor_unitario))}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{h.fonte === "google" ? "ia" : h.fonte}</Badge>
                    {h.fonte_url && <a href={h.fonte_url} target="_blank" rel="noreferrer" className="ml-2 text-xs underline">fonte</a>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteOne(h.id)}>Apagar</Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum preço registrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compras" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de compras &amp; curva de consumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Curva de consumo por item</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead className="text-right">Qtd total</TableHead>
                      <TableHead className="text-right">Consumo/mês</TableHead>
                      <TableHead>Última compra</TableHead>
                      <TableHead className="text-right">Intervalo médio</TableHead>
                      <TableHead className="text-right">Dias desde última</TableHead>
                      <TableHead>Próxima sugerida</TableHead>
                      <TableHead className="text-right">Último preço</TableHead>
                      <TableHead className="text-right">Total gasto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumoCurva.map(c => {
                      const atrasada = c.proximaCompraSugerida && new Date() > c.proximaCompraSugerida;
                      return (
                        <TableRow key={c.key}>
                          <TableCell className="text-xs max-w-[280px]">{c.descricao}</TableCell>
                          <TableCell className="text-xs">{c.facility_unit}</TableCell>
                          <TableCell className="text-right">{c.compras}</TableCell>
                          <TableCell className="text-right">{c.totalQtd} {c.unidade_medida}</TableCell>
                          <TableCell className="text-right">{c.consumoMensal != null ? `${c.consumoMensal.toFixed(1)} ${c.unidade_medida}` : "—"}</TableCell>
                          <TableCell className="text-xs">{fmtDate(c.ultimaData)}</TableCell>
                          <TableCell className="text-right">{c.intervaloMedioDias != null ? `${c.intervaloMedioDias.toFixed(0)} d` : "—"}</TableCell>
                          <TableCell className="text-right">{c.diasDesdeUltima != null ? `${c.diasDesdeUltima} d` : "—"}</TableCell>
                          <TableCell className="text-xs">
                            {c.proximaCompraSugerida ? (
                              <Badge variant={atrasada ? "destructive" : "outline"}>{fmtDate(c.proximaCompraSugerida)}</Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right">{fmtBRL(c.ultimoPreco)}</TableCell>
                          <TableCell className="text-right">{fmtBRL(c.totalValor)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {consumoCurva.length === 0 && (
                      <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhuma compra registrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Compras detalhadas (por OC)</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>OC</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Vlr unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseHistory
                      .filter(p => unitFilter === "all" || p.facility_unit === unitFilter)
                      .filter(p => {
                        if (!search) return true;
                        const q = search.toLowerCase();
                        return [p.descricao, p.fornecedor_nome, p.oc_numero].filter(Boolean).join(" ").toLowerCase().includes(q);
                      })
                      .sort((a, b) => new Date(b.data_compra || 0).getTime() - new Date(a.data_compra || 0).getTime())
                      .map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">{fmtDate(p.data_compra)}</TableCell>
                          <TableCell className="font-mono text-xs">{p.oc_numero}</TableCell>
                          <TableCell className="text-xs">{p.facility_unit}</TableCell>
                          <TableCell className="text-xs max-w-[280px]">{p.descricao}</TableCell>
                          <TableCell className="text-xs">{p.fornecedor_nome}</TableCell>
                          <TableCell className="text-right">{p.quantidade} {p.unidade_medida}</TableCell>
                          <TableCell className="text-right">{fmtBRL(p.valor_unitario)}</TableCell>
                          <TableCell className="text-right">{fmtBRL(p.valor_total)}</TableCell>
                        </TableRow>
                      ))}
                    {purchaseHistory.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma compra autorizada encontrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProductCatalogModal
        open={catalogModalOpen}
        onOpenChange={(o) => { setCatalogModalOpen(o); if (!o) setEditingProduct(null); }}
        onSaved={load}
        editing={editingProduct}
      />

      <SupplierRegistryModal
        open={supplierModalOpen}
        onOpenChange={setSupplierModalOpen}
        onSaved={load}
      />
    </div>
  );
}