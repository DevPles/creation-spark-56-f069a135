import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, Cell,
} from "recharts";
import {
  computeRubricaConsumption,
  formatBRL,
  statusColorClasses,
  type RubricaConsumption,
} from "@/lib/rubricaBudget";

interface Props {
  requisitions: any[];
  quotations: any[];
  orders: any[];
  contracts: any[];
  invitesByReq: Record<string, { total: number; respondidos: number; firstToken?: string }>;
}

type PeriodKey = "month" | "30d" | "90d" | "180d" | "year";

const PERIOD_LABEL: Record<PeriodKey, string> = {
  month: "Mês atual",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "180d": "Últimos 180 dias",
  year: "Ano",
};

const STATUS_LABEL: Record<string, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  autorizada: "Autorizada",
  negada: "Negada",
  enviada: "Enviada",
  recebida: "Recebida",
  cancelada: "Cancelada",
};

const COMMITTED = new Set(["autorizada", "enviada", "recebida"]);

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfYear(d: Date) { return new Date(d.getFullYear(), 0, 1); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function diffDays(a: Date, b: Date) { return Math.floor((b.getTime() - a.getTime()) / 86400000); }

export default function PurchasesDashboardPanel({
  requisitions, quotations, orders, contracts, invitesByReq,
}: Props) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [unit, setUnit] = useState<string>("all");

  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [rubricaEntries, setRubricaEntries] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [oi, inv, re, sup] = await Promise.all([
        (supabase as any).from("purchase_order_items").select("*"),
        (supabase as any).from("quotation_invites").select("*"),
        (supabase as any).from("rubrica_entries").select("*"),
        (supabase as any).from("suppliers").select("id, nome, cnpj, ativo"),
      ]);
      setOrderItems(oi?.data || []);
      setInvites(inv?.data || []);
      setRubricaEntries(re?.data || []);
      setSuppliers(sup?.data || []);
    })();
  }, []);

  const units = useMemo(() => {
    const s = new Set<string>();
    requisitions.forEach(r => r.facility_unit && s.add(r.facility_unit));
    orders.forEach(o => o.facility_unit && s.add(o.facility_unit));
    contracts.forEach(c => c.unit && s.add(c.unit));
    return Array.from(s).sort();
  }, [requisitions, orders, contracts]);

  const periodStart = useMemo<Date>(() => {
    const now = new Date();
    switch (period) {
      case "month": return startOfMonth(now);
      case "30d": return daysAgo(30);
      case "90d": return daysAgo(90);
      case "180d": return daysAgo(180);
      case "year": return startOfYear(now);
    }
  }, [period]);

  const previousStart = useMemo<Date>(() => {
    const now = new Date();
    switch (period) {
      case "month": return new Date(now.getFullYear(), now.getMonth() - 1, 1);
      case "30d": return daysAgo(60);
      case "90d": return daysAgo(180);
      case "180d": return daysAgo(360);
      case "year": return new Date(now.getFullYear() - 1, 0, 1);
    }
  }, [period]);

  const inUnit = (u?: string | null) => unit === "all" || u === unit;
  const inPeriod = (iso?: string | null, from: Date = periodStart, to: Date = new Date()) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t <= to.getTime();
  };

  // ---------- Filtered slices ----------
  const fReqs = useMemo(() => requisitions.filter(r => inUnit(r.facility_unit)), [requisitions, unit]);
  const fQuotes = useMemo(() => quotations.filter(q => inUnit(q.facility_unit)), [quotations, unit]);
  const fOrders = useMemo(() => orders.filter(o => inUnit(o.facility_unit)), [orders, unit]);
  const fInvites = useMemo(() => {
    const reqIds = new Set(fReqs.map(r => r.id));
    return invites.filter(i => reqIds.has(i.requisition_id));
  }, [invites, fReqs]);

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const reqsAbertas = fReqs.filter(r => ["rascunho", "aguardando_cotacao", "em_cotacao"].includes(r.status)).length;
    const reqsAbertasPrev = fReqs.filter(r =>
      ["rascunho", "aguardando_cotacao", "em_cotacao"].includes(r.status) &&
      r.created_at && new Date(r.created_at) < periodStart && new Date(r.created_at) >= previousStart
    ).length;

    const cotAndamento = fQuotes.filter(q => q.status !== "concluida" && q.status !== "cancelada");
    const tempoMedioCot = cotAndamento.length
      ? Math.round(cotAndamento.reduce((s, q) => s + diffDays(new Date(q.created_at), new Date()), 0) / cotAndamento.length)
      : 0;

    const ocAguard = fOrders.filter(o => o.status === "aguardando_aprovacao");
    const ocAguardAtrasadas = ocAguard.filter(o => diffDays(new Date(o.created_at), new Date()) > 3).length;

    const ocAutorizadasPeriod = fOrders.filter(o =>
      ["autorizada", "enviada", "recebida"].includes(o.status) &&
      inPeriod(o.aprovado_em || o.updated_at)
    );

    const invitesPeriod = fInvites.filter(i => inPeriod(i.created_at));
    const respondidos = invitesPeriod.filter(i => i.submitted_at || i.status === "respondido").length;
    const taxaResposta = invitesPeriod.length ? Math.round((respondidos / invitesPeriod.length) * 100) : 0;

    const totalAutorizadoPeriod = ocAutorizadasPeriod.reduce((s, o) => s + Number(o.valor_total || 0), 0);
    const totalRecebidoPeriod = fOrders.filter(o => o.status === "recebida" && inPeriod(o.updated_at))
      .reduce((s, o) => s + Number(o.valor_total || 0), 0);
    const ticketMedio = ocAutorizadasPeriod.length ? totalAutorizadoPeriod / ocAutorizadasPeriod.length : 0;

    return {
      reqsAbertas, reqsAbertasPrev,
      cotAndamento: cotAndamento.length, tempoMedioCot,
      ocAguard: ocAguard.length, ocAguardAtrasadas,
      ocAutorizadasPeriod: ocAutorizadasPeriod.length,
      invitesEnviados: invitesPeriod.length, taxaResposta,
      ticketMedio,
      totalAutorizadoPeriod, totalRecebidoPeriod,
    };
  }, [fReqs, fQuotes, fOrders, fInvites, periodStart, previousStart]);

  // ---------- Funil ----------
  const funnel = useMemo(() => {
    const r = fReqs.length;
    const i = fInvites.length;
    const q = fQuotes.length;
    const oa = fOrders.filter(o => o.status === "aguardando_aprovacao").length;
    const oAuth = fOrders.filter(o => ["autorizada", "enviada", "recebida"].includes(o.status)).length;
    const oRec = fOrders.filter(o => o.status === "recebida").length;
    const max = Math.max(r, i, q, oa, oAuth, oRec, 1);
    const stages = [
      { label: "Requisições", value: r },
      { label: "Convites", value: i },
      { label: "Cotações", value: q },
      { label: "OCs aguardando", value: oa },
      { label: "Autorizadas", value: oAuth },
      { label: "Recebidas", value: oRec },
    ];
    return stages.map((s, idx) => ({
      ...s,
      pct: (s.value / max) * 100,
      conv: idx > 0 && stages[idx - 1].value > 0 ? Math.round((s.value / stages[idx - 1].value) * 100) : null,
    }));
  }, [fReqs, fInvites, fQuotes, fOrders]);

  // ---------- 12 meses ----------
  const last12 = useMemo(() => {
    const months: { key: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), total: 0 });
    }
    fOrders.filter(o => COMMITTED.has(o.status)).forEach(o => {
      const dStr = o.aprovado_em || o.updated_at;
      if (!dStr) return;
      const d = new Date(dStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find(x => x.key === key);
      if (m) m.total += Number(o.valor_total || 0);
    });
    return months;
  }, [fOrders]);

  // ---------- Atenção Imediata ----------
  const attention = useMemo(() => {
    const items: { id: string; severity: "high" | "med"; title: string; subtitle: string; tab?: string; }[] = [];

    fReqs.filter(r => r.status === "rascunho" && diffDays(new Date(r.created_at), new Date()) > 5)
      .forEach(r => items.push({
        id: `req-${r.id}`, severity: "med",
        title: `Requisição ${r.numero} em rascunho há ${diffDays(new Date(r.created_at), new Date())} dias`,
        subtitle: `${r.facility_unit} · ${r.setor || "—"}`, tab: "requisicoes",
      }));

    fQuotes.filter(q => q.status !== "concluida" && q.status !== "cancelada" && !q.winner_supplier && diffDays(new Date(q.created_at), new Date()) > 7)
      .forEach(q => items.push({
        id: `cot-${q.id}`, severity: "med",
        title: `Cotação ${q.numero} aberta há ${diffDays(new Date(q.created_at), new Date())} dias sem campeão`,
        subtitle: q.facility_unit, tab: "cotacoes",
      }));

    fOrders.filter(o => o.status === "aguardando_aprovacao" && diffDays(new Date(o.created_at), new Date()) > 3)
      .forEach(o => items.push({
        id: `oc-${o.id}`, severity: "high",
        title: `OC ${o.numero} aguardando aprovação há ${diffDays(new Date(o.created_at), new Date())} dias`,
        subtitle: `${o.fornecedor_nome} · ${formatBRL(Number(o.valor_total || 0))}`, tab: "ordens",
      }));

    fInvites.filter(i => {
      if (i.submitted_at || i.status === "respondido") return false;
      const exp = new Date(i.expires_at).getTime();
      const now = Date.now();
      return exp > now && exp - now < 48 * 3600 * 1000;
    }).forEach(i => items.push({
      id: `inv-${i.id}`, severity: "med",
      title: `Convite a ${i.fornecedor_nome} expira em <48h`,
      subtitle: `Sem resposta · expira ${new Date(i.expires_at).toLocaleString("pt-BR")}`,
    }));

    return items.sort((a, b) => (a.severity === "high" ? -1 : 1));
  }, [fReqs, fQuotes, fOrders, fInvites]);

  // ---------- Top fornecedores ----------
  const topSuppliers = useMemo(() => {
    const map = new Map<string, { nome: string; cnpj: string; nOcs: number; total: number; lastDate: string }>();
    fOrders.filter(o => COMMITTED.has(o.status) && inPeriod(o.aprovado_em || o.updated_at)).forEach(o => {
      const key = `${o.fornecedor_cnpj || ""}|${o.fornecedor_nome || ""}`;
      const cur = map.get(key) || { nome: o.fornecedor_nome || "—", cnpj: o.fornecedor_cnpj || "—", nOcs: 0, total: 0, lastDate: "" };
      cur.nOcs += 1;
      cur.total += Number(o.valor_total || 0);
      const d = o.aprovado_em || o.updated_at;
      if (d && (!cur.lastDate || new Date(d) > new Date(cur.lastDate))) cur.lastDate = d;
      map.set(key, cur);
    });
    const cnpjSet = new Set(suppliers.map(s => String(s.cnpj || "").replace(/\D/g, "")));
    return Array.from(map.values())
      .map(s => ({ ...s, ticket: s.nOcs ? s.total / s.nOcs : 0, cadastrado: cnpjSet.has(String(s.cnpj || "").replace(/\D/g, "")) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [fOrders, suppliers, periodStart]);

  // ---------- Top itens ----------
  const topItems = useMemo(() => {
    const orderIds = new Set(fOrders.filter(o => COMMITTED.has(o.status) && inPeriod(o.aprovado_em || o.updated_at)).map(o => o.id));
    const prevOrderIds = new Set(fOrders.filter(o =>
      COMMITTED.has(o.status) &&
      o.aprovado_em && new Date(o.aprovado_em) >= previousStart && new Date(o.aprovado_em) < periodStart
    ).map(o => o.id));
    const cur = new Map<string, { qty: number; total: number; }>();
    const prev = new Map<string, { qty: number; total: number; }>();
    orderItems.forEach(it => {
      const desc = (it.descricao || "—").trim();
      if (orderIds.has(it.purchase_order_id)) {
        const c = cur.get(desc) || { qty: 0, total: 0 };
        c.qty += Number(it.quantidade || 0);
        c.total += Number(it.valor_total || 0);
        cur.set(desc, c);
      }
      if (prevOrderIds.has(it.purchase_order_id)) {
        const p = prev.get(desc) || { qty: 0, total: 0 };
        p.qty += Number(it.quantidade || 0);
        p.total += Number(it.valor_total || 0);
        prev.set(desc, p);
      }
    });
    return Array.from(cur.entries())
      .map(([desc, v]) => {
        const p = prev.get(desc);
        const avgCur = v.qty > 0 ? v.total / v.qty : 0;
        const avgPrev = p && p.qty > 0 ? p.total / p.qty : 0;
        const variation = avgPrev > 0 ? ((avgCur - avgPrev) / avgPrev) * 100 : null;
        return { desc, qty: v.qty, total: v.total, avg: avgCur, variation };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [orderItems, fOrders, periodStart, previousStart]);

  // ---------- Conformidade Orçamentária (espelho do Controle de Rubricas) ----------
  const consumption = useMemo<RubricaConsumption[]>(() => {
    return computeRubricaConsumption({
      contracts,
      rubricaEntries,
      purchaseOrders: orders,
      unit,
      // Não filtra entries por mês aqui — alinha com Controle de Rubricas
      // (orçamento e execução são acumulativos no contrato).
      period: { year: "all", month0: "all" },
    });
  }, [contracts, rubricaEntries, orders, unit]);

  const rubricasAlerta = consumption.filter(c => c.status === "critical" || c.status === "over");

  // ---------- Distribuição por unidade e status ----------
  const byUnit = useMemo(() => {
    const map = new Map<string, number>();
    fOrders.filter(o => COMMITTED.has(o.status) && inPeriod(o.aprovado_em || o.updated_at)).forEach(o => {
      map.set(o.facility_unit, (map.get(o.facility_unit) || 0) + Number(o.valor_total || 0));
    });
    return Array.from(map.entries()).map(([unit, total]) => ({ unit, total })).sort((a, b) => b.total - a.total);
  }, [fOrders, periodStart]);

  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    fOrders.forEach(o => map.set(o.status, (map.get(o.status) || 0) + 1));
    return Array.from(map.entries()).map(([status, count]) => ({
      status, label: STATUS_LABEL[status] || status, count,
    })).sort((a, b) => b.count - a.count);
  }, [fOrders]);

  // ---------- Render ----------
  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map(k =>
                <SelectItem key={k} value={k}>{PERIOD_LABEL[k]}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => navigate("/controle-rubrica")}>
          Ver Controle de Rubricas
        </Button>
      </div>

      {/* KPIs operacionais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Requisições abertas" value={kpis.reqsAbertas}
          delta={kpis.reqsAbertas - kpis.reqsAbertasPrev} hint="vs período anterior" />
        <KpiBox label="Cotações em andamento" value={kpis.cotAndamento}
          subtitle={`${kpis.tempoMedioCot} dias em média`} />
        <KpiBox label="OCs aguardando aprovação" value={kpis.ocAguard}
          subtitle={kpis.ocAguardAtrasadas > 0 ? `${kpis.ocAguardAtrasadas} atrasada${kpis.ocAguardAtrasadas > 1 ? "s" : ""} >3 dias` : "no prazo"}
          danger={kpis.ocAguardAtrasadas > 0} />
        <KpiBox label="OCs autorizadas no período" value={kpis.ocAutorizadasPeriod} />
        <KpiBox label="Convites enviados" value={kpis.invitesEnviados}
          subtitle={`${kpis.taxaResposta}% de resposta`} />
        <KpiBox label="Ticket médio de OC" value={formatBRL(kpis.ticketMedio)} valueSize="text-xl" />
        <KpiBox label="Total autorizado" value={formatBRL(kpis.totalAutorizadoPeriod)} valueSize="text-xl" />
        <KpiBox label="Total recebido" value={formatBRL(kpis.totalRecebidoPeriod)} valueSize="text-xl" />
      </div>

      {/* Funil */}
      <Card>
        <CardHeader><CardTitle className="text-base">Funil de Compras</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {funnel.map((s) => {
              return (
                <div key={s.label} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
                  <div className="text-sm">{s.label}</div>
                  <div className="relative h-7 rounded-md bg-muted overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-primary/80 rounded-md transition-all"
                         style={{ width: `${Math.max(s.pct, 2)}%` }} />
                    <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-foreground">
                      {s.value}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground w-16 text-right">
                    {s.conv !== null ? `${s.conv}%` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Conformidade Orçamentária — núcleo */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Conformidade Orçamentária por Rubrica</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Orçamento contratado × lançamentos + OCs autorizadas — mesma base do Controle de Rubricas.
            </p>
          </div>
          {rubricasAlerta.length > 0 && (
            <Badge variant="outline" className="border-destructive/30 text-destructive">
              {rubricasAlerta.length} em alerta
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {consumption.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma rubrica cadastrada para o filtro atual.</p>
          ) : (
            <div className="space-y-4">
              {consumption.map(c => {
                const cls = statusColorClasses(c.status);
                const pctDisplay = Math.min(c.pct, 100);
                return (
                  <div key={`${c.contractId}-${c.rubricaId}`} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.rubricaName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.contractName} · {c.unit}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className={`text-sm font-semibold ${cls.text}`}>{c.pct.toFixed(0)}%</div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatBRL(c.totalSpent)} / {formatBRL(c.budget)}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs"
                                onClick={() => navigate("/controle-rubrica")}>
                          Ver
                        </Button>
                      </div>
                    </div>
                    <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`absolute inset-y-0 left-0 ${cls.bar} transition-all`}
                           style={{ width: `${pctDisplay}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Lançado: {formatBRL(c.spentEntries)} · Em OCs: {formatBRL(c.spentOrders)}</span>
                      <span>Saldo: {formatBRL(c.remaining)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Atenção imediata */}
        <Card>
          <CardHeader><CardTitle className="text-base">Atenção imediata</CardTitle></CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nada pendente. Tudo em dia.</p>
            ) : (
              <ul className="space-y-2 max-h-[360px] overflow-auto pr-2">
                {attention.map(a => (
                  <li key={a.id} className={`p-3 rounded-md border ${
                    a.severity === "high" ? "border-destructive/30 bg-destructive/5" : "border-amber-200/50 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5"
                  }`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.subtitle}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Distribuição por unidade + status */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Gasto autorizado por unidade</p>
              {byUnit.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados no período.</p>
              ) : (
                <div className="space-y-2">
                  {byUnit.map(u => {
                    const max = Math.max(...byUnit.map(x => x.total));
                    return (
                      <div key={u.unit} className="grid grid-cols-[140px_1fr_auto] items-center gap-2 text-xs">
                        <span className="truncate">{u.unit}</span>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary/70" style={{ width: `${(u.total / max) * 100}%` }} />
                        </div>
                        <span className="font-medium tabular-nums">{formatBRL(u.total)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">OCs por status</p>
              <div className="flex flex-wrap gap-2">
                {byStatus.map(s => (
                  <Badge key={s.status} variant="outline" className="text-xs">
                    {s.label}: <span className="ml-1 font-semibold">{s.count}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 12 meses */}
      <Card>
        <CardHeader><CardTitle className="text-base">Gasto autorizado — últimos 12 meses</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last12} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatBRL(v), "Autorizado"]}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {last12.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top fornecedores */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Top fornecedores ({PERIOD_LABEL[period]})
          </CardTitle></CardHeader>
          <CardContent>
            {topSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem OCs no período.</p>
            ) : (
              <div className="space-y-2">
                {topSuppliers.map((s, i) => (
                  <div key={`${s.cnpj}-${i}`} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{s.nome}</span>
                        {s.cadastrado && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Cadastrado</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.cnpj} · {s.nOcs} OC{s.nOcs > 1 ? "s" : ""} · ticket {formatBRL(s.ticket)}</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums shrink-0">{formatBRL(s.total)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top itens */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Top itens comprados ({PERIOD_LABEL[period]})
          </CardTitle></CardHeader>
          <CardContent>
            {topItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem itens no período.</p>
            ) : (
              <div className="space-y-2">
                {topItems.map((it, i) => (
                  <div key={`${it.desc}-${i}`} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{it.desc}</div>
                      <div className="text-xs text-muted-foreground">
                        Qtd: {it.qty.toLocaleString("pt-BR")} · Médio: {formatBRL(it.avg)}
                        {it.variation !== null && (
                          <span className={`ml-2 inline-flex items-center gap-0.5 ${it.variation > 0 ? "text-destructive" : "text-emerald-600"}`}>
                            {it.variation > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {Math.abs(it.variation).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums shrink-0">{formatBRL(it.total)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiBox({
  label, value, subtitle, icon: Icon, delta, hint, danger, valueSize = "text-2xl",
}: {
  label: string; value: string | number; subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  delta?: number; hint?: string; danger?: boolean; valueSize?: string;
}) {
  const showDelta = typeof delta === "number" && delta !== 0;
  return (
    <Card className={danger ? "border-destructive/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
          <Icon className={`h-4 w-4 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        <p className={`mt-2 font-semibold ${valueSize} ${danger ? "text-destructive" : "text-foreground"}`}>{value}</p>
        {(subtitle || showDelta) && (
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {showDelta && (
              <span className={`inline-flex items-center gap-0.5 ${delta! > 0 ? "text-emerald-600" : "text-destructive"}`}>
                {delta! > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(delta!)}
              </span>
            )}
            {hint && showDelta && <span>{hint}</span>}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}