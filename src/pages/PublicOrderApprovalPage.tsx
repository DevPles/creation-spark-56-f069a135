import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function PublicOrderApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [name, setName] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [decision, setDecision] = useState<"aprovado" | "recusado">("aprovado");
  const [motivo, setMotivo] = useState("");
  const [ciencia, setCiencia] = useState(false);
  const [ip, setIp] = useState<string>("");
  const [doneInfo, setDoneInfo] = useState<{ decision: string; name: string; at: string } | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    const { data: res, error: rpcErr } = await (supabase as any).rpc("get_order_for_approval", { _token: token });
    if (rpcErr) { setError("Erro ao carregar"); setLoading(false); return; }
    if (res?.error) {
      setError(res.error === "expired" ? "Este link expirou." : "Ordem não encontrada.");
      setLoading(false); return;
    }
    setData(res);
    if (res?.approval?.signed_at) {
      setDoneInfo({
        decision: res.approval.decision,
        name: res.approval.approver_name,
        at: new Date(res.approval.signed_at).toLocaleString("pt-BR"),
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);
  useEffect(() => {
    fetch("https://api.ipify.org?format=json").then(r => r.json()).then(j => setIp(j.ip || "")).catch(() => {});
  }, []);

  const submit = async () => {
    if (!name.trim()) { toast.error("Informe seu nome"); return; }
    if (!ciencia) { toast.error("Marque a ciência para confirmar"); return; }
    if (decision === "recusado" && !motivo.trim()) { toast.error("Informe o motivo da recusa"); return; }
    setSubmitting(true);
    const { data: res, error: rpcErr } = await (supabase as any).rpc("submit_order_approval", {
      _token: token,
      _decision: decision,
      _approver_name: name,
      _approver_cargo: cargo,
      _approver_email: email,
      _ip: ip,
      _motivo_recusa: decision === "recusado" ? motivo : null,
      _ciencia: ciencia,
    });
    setSubmitting(false);
    if (rpcErr || !res?.success) {
      toast.error("Erro ao registrar assinatura");
      return;
    }
    toast.success(decision === "aprovado" ? "OC autorizada com sucesso!" : "OC recusada — registro salvo.");
    setDoneInfo({ decision, name, at: new Date().toLocaleString("pt-BR") });
    load();
  };

  const valorTotal = useMemo(() => Number(data?.order?.valor_total || 0), [data]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (error) return <div className="p-8 text-center text-destructive">{error}</div>;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
              <span>Aprovação de Ordem de Compra</span>
              <Badge variant="outline">OC {data?.order?.numero}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><Label className="text-xs">Requisição</Label><div>{data?.order?.requisicao_numero || "—"}</div></div>
              <div><Label className="text-xs">Unidade</Label><div>{data?.order?.facility_unit}</div></div>
              <div><Label className="text-xs">Rubrica</Label><div>{data?.order?.rubrica_name || "—"}</div></div>
              <div><Label className="text-xs">Fornecedor</Label><div>{data?.order?.fornecedor_nome}</div></div>
              <div><Label className="text-xs">CNPJ</Label><div>{data?.order?.fornecedor_cnpj || "—"}</div></div>
              <div><Label className="text-xs">Prazo</Label><div>{data?.order?.prazo_entrega || "—"}</div></div>
              <div className="md:col-span-3"><Label className="text-xs">Endereço de entrega</Label><div>{data?.order?.endereco_entrega || "—"}</div></div>
            </div>
            {Number(data?.order?.rubrica_budget || 0) > 0 && (() => {
              const budget = Number(data.order.rubrica_budget);
              const spent = Number(data.order.rubrica_spent || 0);
              const thisOc = Number(data.order.valor_total || 0);
              const after = spent + thisOc;
              const pct = budget > 0 ? (after / budget) * 100 : 0;
              const exceeds = after > budget;
              return (
                <div className={`rounded-md p-3 text-sm border ${exceeds ? "bg-destructive/10 border-destructive/30" : "bg-muted/50"}`}>
                  <div className="font-medium mb-1">Impacto na rubrica — {data.order.rubrica_name || "—"}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><Label className="text-xs">Orçamento</Label><div className="font-semibold">{fmtBRL(budget)}</div></div>
                    <div><Label className="text-xs">Já gasto</Label><div>{fmtBRL(spent)}</div></div>
                    <div><Label className="text-xs">Esta OC</Label><div>{fmtBRL(thisOc)}</div></div>
                    <div><Label className="text-xs">Saldo após</Label><div className={exceeds ? "text-destructive font-semibold" : "font-semibold"}>{fmtBRL(budget - after)}</div></div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Utilização total: {pct.toFixed(1)}%{exceeds ? " — ultrapassa o saldo da rubrica" : ""}</div>
                </div>
              );
            })()}
            {data?.order?.observacoes && (
              <div><Label className="text-xs">Observações</Label><div className="whitespace-pre-wrap">{data.order.observacoes}</div></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Itens</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-20 text-right">Qtd</TableHead>
                  <TableHead className="w-16">Un.</TableHead>
                  <TableHead className="w-32 text-right">Valor unit.</TableHead>
                  <TableHead className="w-32 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items || []).map((it: any) => (
                  <TableRow key={it.item_num}>
                    <TableCell>{it.item_num}</TableCell>
                    <TableCell className="text-xs">{it.descricao}</TableCell>
                    <TableCell className="text-right">{it.quantidade}</TableCell>
                    <TableCell>{it.unidade_medida}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(it.valor_unitario))}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(it.valor_total))}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-semibold">TOTAL GERAL</TableCell>
                  <TableCell className="text-right font-semibold">{fmtBRL(valorTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {doneInfo ? (
          <Card>
            <CardHeader><CardTitle>Assinatura registrada</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div>Decisão: <Badge variant={doneInfo.decision === "aprovado" ? "default" : "destructive"}>{doneInfo.decision}</Badge></div>
              <div>Assinado por: <strong>{doneInfo.name}</strong></div>
              <div>Em: {doneInfo.at}</div>
              <p className="text-muted-foreground pt-2">Você pode fechar esta página. O sistema já foi atualizado.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Sua decisão</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Nome completo *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                <div><Label>Cargo</Label><Input value={cargo} onChange={e => setCargo(e.target.value)} /></div>
                <div className="md:col-span-2"><Label>E-mail (opcional)</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={decision === "aprovado" ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setDecision("aprovado")}
                >Aprovar</Button>
                <Button
                  variant={decision === "recusado" ? "destructive" : "outline"}
                  className="rounded-full"
                  onClick={() => setDecision("recusado")}
                >Recusar</Button>
              </div>
              {decision === "recusado" && (
                <div><Label>Motivo da recusa *</Label><Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} /></div>
              )}
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={ciencia} onCheckedChange={(v) => setCiencia(!!v)} />
                <span>Declaro estar ciente do conteúdo desta Ordem de Compra e autorizo o registro da minha assinatura digital, com captura de IP, data e hora para fins de auditoria.</span>
              </label>
              <div className="text-xs text-muted-foreground">IP detectado: {ip || "—"}</div>
              <Button className="rounded-full" onClick={submit} disabled={submitting}>
                {submitting ? "Registrando…" : "Registrar assinatura"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}