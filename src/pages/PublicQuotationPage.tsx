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
import { toast } from "sonner";

type Item = {
  id: string;
  item_num: number;
  descricao: string;
  quantidade: number;
  unidade_medida: string;
  observacao?: string;
};

type Row = {
  requisition_item_id: string;
  valor_unitario: string;
  disponivel: boolean;
  observacao: string;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function PublicQuotationPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [condPagamento, setCondPagamento] = useState("");
  const [obs, setObs] = useState("");
  const [submittedOk, setSubmittedOk] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    const { data: res, error: rpcErr } = await (supabase as any).rpc("get_invite_by_token", { _token: token });
    if (rpcErr) {
      setError("Erro ao carregar convite");
      setLoading(false);
      return;
    }
    if (res?.error) {
      setError(res.error === "expired" ? "Este link expirou." : "Convite não encontrado.");
      setLoading(false);
      return;
    }
    setData(res);
    const items: Item[] = res.items || [];
    const existing: any[] = res.responses || [];
    setRows(items.map(it => {
      const found = existing.find(r => r.requisition_item_id === it.id);
      return {
        requisition_item_id: it.id,
        valor_unitario: found ? String(found.valor_unitario ?? "") : "",
        disponivel: found ? !!found.disponivel : true,
        observacao: found?.observacao || "",
      };
    }));
    if (res.invite?.prazo_entrega) setPrazoEntrega(res.invite.prazo_entrega);
    if (res.invite?.condicao_pagamento) setCondPagamento(res.invite.condicao_pagamento);
    if (res.invite?.observacoes) setObs(res.invite.observacoes);
    if (res.invite?.submitted_at) setSubmittedOk(true);
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  const items: Item[] = data?.items || [];
  const totalGeral = useMemo(() => {
    return rows.reduce((sum, r) => {
      if (!r.disponivel) return sum;
      const it = items.find(i => i.id === r.requisition_item_id);
      const v = parseFloat(r.valor_unitario.replace(",", ".")) || 0;
      return sum + v * (it?.quantidade || 0);
    }, 0);
  }, [rows, items]);

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows(prev => prev.map(r => r.requisition_item_id === id ? { ...r, ...patch } : r));
  };

  const handleSubmit = async () => {
    if (!token) return;
    const hasAvailable = rows.some(r => r.disponivel);
    if (!hasAvailable) {
      toast.error("Informe pelo menos um item disponível");
      return;
    }
    const missing = rows.find(r => r.disponivel && (!r.valor_unitario || parseFloat(r.valor_unitario.replace(",", ".")) <= 0));
    if (missing) {
      toast.error("Preencha o valor unitário dos itens disponíveis");
      return;
    }
    if (!prazoEntrega.trim() || !condPagamento.trim()) {
      toast.error("Preencha prazo de entrega e condição de pagamento");
      return;
    }
    setSubmitting(true);
    const responses = rows.map(r => ({
      requisition_item_id: r.requisition_item_id,
      valor_unitario: parseFloat((r.valor_unitario || "0").replace(",", ".")) || 0,
      disponivel: r.disponivel,
      observacao: r.observacao || null,
    }));
    const { data: res, error: rpcErr } = await (supabase as any).rpc("submit_invite_response", {
      _token: token,
      _prazo_entrega: prazoEntrega,
      _condicao_pagamento: condPagamento,
      _observacoes: obs,
      _responses: responses,
    });
    setSubmitting(false);
    if (rpcErr || !res?.success) {
      const code = res?.error;
      if (code === "already_submitted") {
        toast.error("Esta proposta já foi enviada");
        setSubmittedOk(true);
        return;
      }
      if (code === "expired") {
        toast.error("Link expirado");
        return;
      }
      toast.error("Erro ao enviar proposta");
      return;
    }
    toast.success("Proposta enviada com sucesso");
    setSubmittedOk(true);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Convite indisponível</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (submittedOk) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-lg w-full">
          <CardHeader><CardTitle>Proposta recebida</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">
              Obrigado, <strong>{data?.invite?.fornecedor_nome}</strong>! Sua cotação para a requisição{" "}
              <strong>{data?.requisition?.numero}</strong> foi registrada.
            </p>
            <p className="text-sm text-muted-foreground">Total proposto: <strong>{fmtBRL(totalGeral)}</strong></p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto max-w-5xl px-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cotação para {data?.requisition?.facility_unit}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><div className="text-muted-foreground">Requisição</div><div className="font-medium">{data?.requisition?.numero}</div></div>
            <div><div className="text-muted-foreground">Setor</div><div className="font-medium">{data?.requisition?.setor || "—"}</div></div>
            <div><div className="text-muted-foreground">Fornecedor convidado</div><div className="font-medium">{data?.invite?.fornecedor_nome}</div></div>
            <div><div className="text-muted-foreground">Data da requisição</div><div className="font-medium">{data?.requisition?.data_requisicao ? new Date(data.requisition.data_requisicao).toLocaleDateString("pt-BR") : "—"}</div></div>
            <div><div className="text-muted-foreground">Validade do link</div><div className="font-medium">{data?.invite?.expires_at ? new Date(data.invite.expires_at).toLocaleDateString("pt-BR") : "—"}</div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Itens para cotar</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead className="w-32">Disponível</TableHead>
                  <TableHead className="w-40">Valor unitário (R$)</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(it => {
                  const row = rows.find(r => r.requisition_item_id === it.id)!;
                  const v = parseFloat((row?.valor_unitario || "0").replace(",", ".")) || 0;
                  const total = row?.disponivel ? v * (it.quantidade || 0) : 0;
                  return (
                    <TableRow key={it.id}>
                      <TableCell>{it.item_num}</TableCell>
                      <TableCell>{it.descricao}</TableCell>
                      <TableCell className="text-right">{it.quantidade}</TableCell>
                      <TableCell>{it.unidade_medida}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={row?.disponivel}
                            onCheckedChange={(c) => updateRow(it.id, { disponivel: !!c })}
                          />
                          <span className="text-xs text-muted-foreground">{row?.disponivel ? "Sim" : "Não"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={row?.valor_unitario || ""}
                          disabled={!row?.disponivel}
                          onChange={e => updateRow(it.id, { valor_unitario: e.target.value })}
                          placeholder="0,00"
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm">{fmtBRL(total)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-end pt-4 text-base">
              Total geral: <span className="ml-2 font-semibold">{fmtBRL(totalGeral)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Condições gerais</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Prazo de entrega *</Label>
              <Input value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} placeholder="Ex.: 5 dias úteis" />
            </div>
            <div>
              <Label>Condição de pagamento *</Label>
              <Input value={condPagamento} onChange={e => setCondPagamento(e.target.value)} placeholder="Ex.: 30 dias após entrega" />
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button className="rounded-full" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Enviando..." : "Enviar proposta"}
          </Button>
        </div>
      </div>
    </div>
  );
}