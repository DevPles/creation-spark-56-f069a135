import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { UNIVIDA_LOGO_BASE64 } from "@/assets/univida-logo-base64";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string | null;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fmtDateTime = (s?: string | null) =>
  s ? format(new Date(s), "dd/MM/yyyy HH:mm") : "—";

const fmtDate = (s?: string | null) =>
  s ? format(new Date(s), "dd/MM/yyyy") : "—";

export default function OrderDossierModal({ open, onOpenChange, orderId }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dossier, setDossier] = useState<any>(null);

  useEffect(() => {
    if (!open || !orderId) return;
    setLoading(true);
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_order_dossier", { _order_id: orderId });
      if (error || data?.error) {
        toast.error("Não foi possível carregar o dossiê");
        setDossier(null);
      } else {
        setDossier(data);
      }
      setLoading(false);
    })();
  }, [open, orderId]);

  const generatePDF = () => {
    if (!dossier) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    const order = dossier.order || {};
    const req = dossier.requisition;
    const quotation = dossier.quotation;
    const contract = dossier.contract;
    const invites: any[] = dossier.invites || [];
    const suppliers: any[] = dossier.quote_suppliers || [];
    const prices: any[] = dossier.quote_prices || [];
    const reqItems: any[] = dossier.requisition_items || [];
    const orderItems: any[] = dossier.order_items || [];
    const approvals: any[] = dossier.approvals || [];
    const audit: any[] = dossier.audit_log || [];
    const generatedAt = dossier.generated_at ? new Date(dossier.generated_at) : new Date();

    // ===== COVER =====
    doc.setFillColor(13, 79, 79); // teal
    doc.rect(0, 0, pageW, 130, "F");
    try {
      // Logo Instituto Univida — proporção nativa 300x164 (~1.829:1)
      const logoH = 70;
      const logoW = logoH * (300 / 164); // mantém proporção real
      const logoX = pageW - margin - logoW;
      const logoY = (130 - logoH) / 2;
      doc.addImage(UNIVIDA_LOGO_BASE64, "PNG", logoX, logoY, logoW, logoH, undefined, "FAST");
    } catch (_) {}
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("DOSSIÊ DE AUDITORIA", margin, 55);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Ordem de Compra — Pronto para Tribunal de Contas", margin, 78);
    doc.text("Instituto Univida — Sistema MetricOss (Moss)", margin, 96);

    doc.setTextColor(0, 0, 0);
    let y = 170;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`OC ${order.numero || "—"}`, margin, y);
    y += 24;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const coverRows = [
      ["Unidade hospitalar", order.facility_unit || "—"],
      ["Fornecedor vencedor", order.fornecedor_nome || "—"],
      ["CNPJ do fornecedor", order.fornecedor_cnpj || "—"],
      ["Valor total", fmtBRL(Number(order.valor_total || 0))],
      ["Status atual", String(order.status || "—")],
      ["Emitida em", fmtDateTime(order.created_at)],
      ["Aprovada em", fmtDateTime(order.aprovado_em)],
      ["Emitida por", order.created_by_name || "—"],
      ["Contrato vinculado", contract?.name || "—"],
      ["Rubrica utilizada", order.rubrica_name || "—"],
      ["Dossiê gerado em", format(generatedAt, "dd/MM/yyyy HH:mm")],
      ["Gerado por", profile?.name || "—"],
    ];
    autoTable(doc, {
      startY: y,
      head: [],
      body: coverRows,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 160 } },
      margin: { left: margin, right: margin },
    });

    // ===== SECTION 1: TIMELINE =====
    doc.addPage();
    sectionTitle(doc, "Seção 1 — Histórico do processo (linha do tempo)", margin);
    const timeline: Array<[string, string]> = [];
    if (req) {
      timeline.push([fmtDateTime(req.created_at), `Requisição ${req.numero} criada — Solicitante: ${req.solicitante_nome || "—"} | Setor: ${req.setor || "—"}`]);
    }
    invites.forEach((iv) => {
      timeline.push([fmtDateTime(iv.created_at), `Convite enviado para ${iv.fornecedor_nome} (${iv.fornecedor_cnpj || "sem CNPJ"}) — Email: ${iv.fornecedor_email || "—"} | Tel: ${iv.fornecedor_telefone || "—"}`]);
      if (iv.submitted_at) {
        const resp = iv.responder_name
          ? ` — Respondido por ${iv.responder_name} <${iv.responder_email || "?"}> tel ${iv.responder_phone || "?"}${iv.responder_cpf ? ` CPF ${iv.responder_cpf}` : ""}`
          : "";
        timeline.push([fmtDateTime(iv.submitted_at), `Resposta recebida via link público de ${iv.fornecedor_nome}${resp} — IP: ${iv.submission_ip || "não capturado"}`]);
      }
    });
    if (quotation) {
      timeline.push([fmtDateTime(quotation.created_at), `Cotação ${quotation.numero} consolidada — Vencedor: ${quotation.winner_supplier || "—"}`]);
    }
    timeline.push([fmtDateTime(order.created_at), `Ordem de Compra ${order.numero} emitida por ${order.created_by_name || "—"}`]);
    approvals.forEach((a) => {
      if (a.signed_at) {
        timeline.push([fmtDateTime(a.signed_at), `${a.decision === "aprovado" ? "APROVADA" : "RECUSADA"} por ${a.approver_name || "—"} (${a.approver_cargo || "—"}) — IP: ${a.approver_ip || "—"} | LGPD: ${a.ciencia_lgpd ? "Sim" : "Não"}`]);
      }
    });
    audit.forEach((l) => {
      timeline.push([fmtDateTime(l.changed_at), `[${l.entity_type}/${l.action}] ${l.changed_by_name || "—"}${l.motivo ? " — " + l.motivo : ""}`]);
    });
    timeline.sort((a, b) => a[0].localeCompare(b[0]));

    autoTable(doc, {
      startY: 90,
      head: [["Data/Hora", "Evento"]],
      body: timeline,
      theme: "striped",
      headStyles: { fillColor: [13, 79, 79], textColor: 255, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: 100 } },
      margin: { left: margin, right: margin },
    });

    // ===== SECTION 2: PRICE GRID =====
    doc.addPage();
    sectionTitle(doc, "Seção 2 — Grade comparativa de preços", margin);

    // Monta lista unificada de "colunas-fornecedor" combinando suppliers da cotação e convites respondidos
    type SupplierCol = {
      key: string;
      nome: string;
      cnpj: string;
      isWinner: boolean;
      total: number;
      getPriceForItem: (itemId: string) => { valor_unitario: number; valor_total: number; disponivel: boolean } | null;
    };
    const supplierCols: SupplierCol[] = [];

    suppliers.forEach((s: any) => {
      supplierCols.push({
        key: `s-${s.id}`,
        nome: s.fornecedor_nome,
        cnpj: s.fornecedor_cnpj || "",
        isWinner: !!(quotation && quotation.winner_supplier && quotation.winner_supplier === s.fornecedor_nome),
        total: Number(s.total || 0),
        getPriceForItem: (itemId: string) => {
          const p = prices.find((x: any) => x.supplier_id === s.id && x.requisition_item_id === itemId);
          if (!p) return null;
          return { valor_unitario: Number(p.valor_unitario), valor_total: Number(p.valor_total), disponivel: true };
        },
      });
    });

    // Adiciona convites respondidos que não estejam já como suppliers da cotação
    invites.forEach((iv: any) => {
      if (!iv.submitted_at) return;
      const already = supplierCols.find(
        (c) => c.nome === iv.fornecedor_nome || (iv.fornecedor_cnpj && c.cnpj === iv.fornecedor_cnpj)
      );
      if (already) return;
      const responses: any[] = iv.responses || [];
      const total = responses.reduce(
        (acc, r) => acc + (r.disponivel ? Number(r.valor_unitario || 0) * (reqItems.find((i: any) => i.id === r.requisition_item_id)?.quantidade || 0) : 0),
        0
      );
      supplierCols.push({
        key: `i-${iv.id}`,
        nome: iv.fornecedor_nome,
        cnpj: iv.fornecedor_cnpj || "",
        isWinner: false,
        total,
        getPriceForItem: (itemId: string) => {
          const r = responses.find((x: any) => x.requisition_item_id === itemId);
          if (!r) return null;
          const it = reqItems.find((i: any) => i.id === itemId);
          const vu = Number(r.valor_unitario || 0);
          return { valor_unitario: vu, valor_total: vu * (it?.quantidade || 0), disponivel: !!r.disponivel };
        },
      });
    });

    if (supplierCols.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Nenhuma proposta de fornecedor registrada para esta OC.", margin, 100);
      doc.setTextColor(0, 0, 0);
    } else {
      const head = ["#", "Item", "Qtd"];
      supplierCols.forEach((s) => head.push(`${s.nome}${s.isWinner ? " ★" : ""}\n${s.cnpj}`));
      const body = reqItems.map((it: any) => {
        const row: any[] = [it.item_num, it.descricao, `${it.quantidade} ${it.unidade_medida}`];
        supplierCols.forEach((s) => {
          const p = s.getPriceForItem(it.id);
          if (!p) row.push("—");
          else if (!p.disponivel) row.push("Indisponível");
          else row.push(`${fmtBRL(p.valor_unitario)}\nTotal ${fmtBRL(p.valor_total)}`);
        });
        return row;
      });
      const totalsRow: any[] = ["", "TOTAL", ""];
      supplierCols.forEach((s) => totalsRow.push(fmtBRL(s.total)));
      body.push(totalsRow);

      autoTable(doc, {
        startY: 90,
        head: [head],
        body,
        theme: "grid",
        headStyles: { fillColor: [13, 79, 79], textColor: 255, fontSize: 7, halign: "center" },
        styles: { fontSize: 7, cellPadding: 3, valign: "middle" },
        columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 50 } },
        margin: { left: margin, right: margin },
      });
    }

    let y2 = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Log de preenchimento dos fornecedores", margin, y2);
    y2 += 8;
    autoTable(doc, {
      startY: y2,
      head: [["Fornecedor", "CNPJ", "Origem", "Data/Hora envio", "IP da máquina", "Link público enviado"]],
      body: suppliers.map((s) => {
        const inv = invites.find((i) => i.fornecedor_cnpj === s.fornecedor_cnpj || i.fornecedor_nome === s.fornecedor_nome);
        const link = inv?.id
          ? `${window.location.origin}/cotacao-publica/${inv.id}`
          : "—";
        return [
          s.fornecedor_nome,
          s.fornecedor_cnpj || "—",
          s.fonte === "invite_link" ? "Link público" : "Manual",
          fmtDateTime(inv?.submitted_at || s.created_at),
          s.submission_ip || inv?.submission_ip || "não capturado",
          link,
        ];
      }),
      theme: "striped",
      headStyles: { fillColor: [13, 79, 79], textColor: 255, fontSize: 7, halign: "center" },
      styles: { fontSize: 7, cellPadding: 3, valign: "middle", overflow: "linebreak" },
      columnStyles: { 5: { cellWidth: 130, textColor: [13, 79, 79] } },
      margin: { left: margin, right: margin },
    });

    // Tabela complementar: TODOS os convites enviados (mesmo sem resposta)
    if (invites.length > 0) {
      let y3 = (doc as any).lastAutoTable.finalY + 14;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Convites enviados aos fornecedores (rastreabilidade completa)", margin, y3);
      y3 += 8;
      autoTable(doc, {
        startY: y3,
        head: [["Fornecedor", "CNPJ", "Contato fornecedor", "Enviado em", "Status", "Respondido em", "Respondente (nome / e-mail / cel / CPF)", "IP", "Link público"]],
        body: invites.map((iv: any) => {
          const respondente = iv.responder_name
            ? `${iv.responder_name}\n${iv.responder_email || "—"}\nTel: ${iv.responder_phone || "—"}${iv.responder_cpf ? `\nCPF: ${iv.responder_cpf}` : ""}`
            : "—";
          return [
            iv.fornecedor_nome,
            iv.fornecedor_cnpj || "—",
            [iv.fornecedor_email, iv.fornecedor_telefone].filter(Boolean).join(" / ") || "—",
            fmtDateTime(iv.created_at),
            iv.submitted_at ? "Respondido" : "Pendente",
            iv.submitted_at ? fmtDateTime(iv.submitted_at) : "—",
            respondente,
            iv.submission_ip || "—",
            `${window.location.origin}/cotacao-publica/${iv.id}`,
          ];
        }),
        theme: "grid",
        headStyles: { fillColor: [13, 79, 79], textColor: 255, fontSize: 6.5, halign: "center" },
        styles: { fontSize: 6.5, cellPadding: 2, valign: "middle", overflow: "linebreak" },
        columnStyles: { 6: { cellWidth: 95 }, 8: { cellWidth: 95, textColor: [13, 79, 79] } },
        margin: { left: margin, right: margin },
      });
    }

    // ===== SECTION 3: ITEMS =====
    doc.addPage();
    sectionTitle(doc, "Seção 3 — Itens comprados", margin);
    const itemsBody = reqItems.map((it, idx) => {
      const oi = orderItems.find((o) => o.descricao === it.descricao) || orderItems[idx];
      return [
        it.item_num,
        it.codigo || "—",
        it.descricao,
        `${it.quantidade} ${it.unidade_medida}`,
        oi ? fmtBRL(Number(oi.valor_unitario)) : "—",
        oi ? fmtBRL(Number(oi.valor_total)) : "—",
        it.setor || "—",
      ];
    });
    autoTable(doc, {
      startY: 90,
      head: [["#", "Código", "Descrição", "Qtd", "V. unit.", "Total", "Setor"]],
      body: itemsBody,
      theme: "grid",
      headStyles: { fillColor: [13, 79, 79], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 70 } },
      margin: { left: margin, right: margin },
    });

    // ===== SECTION 4: APPROVAL =====
    doc.addPage();
    sectionTitle(doc, "Seção 4 — Aprovação e rastreabilidade legal", margin);
    const apprRows: any[] = [];
    approvals.forEach((a) => {
      apprRows.push(["Aprovador", a.approver_name || "—"]);
      apprRows.push(["Cargo", a.approver_cargo || "—"]);
      apprRows.push(["E-mail", a.approver_email || "—"]);
      apprRows.push(["Endereço IP", a.approver_ip || "—"]);
      apprRows.push(["Ciência LGPD", a.ciencia_lgpd ? "Sim" : "Não"]);
      apprRows.push(["Decisão", a.decision || "—"]);
      apprRows.push(["Data/Hora da assinatura", fmtDateTime(a.signed_at)]);
      if (a.motivo_recusa) apprRows.push(["Motivo da recusa", a.motivo_recusa]);
      apprRows.push(["", ""]);
    });
    if (contract) {
      apprRows.push(["Contrato vinculado", contract.name]);
      apprRows.push(["Valor do contrato", fmtBRL(Number(contract.value || 0))]);
      apprRows.push(["Rubrica %", `${Number(contract.rubrica_percent || 0).toFixed(2)} %`]);
      apprRows.push(["Orçamento da rubrica", fmtBRL(Number(contract.rubrica_budget || 0))]);
      apprRows.push(["Já gasto na rubrica", fmtBRL(Number(contract.rubrica_spent || 0))]);
      apprRows.push(["Saldo após esta OC", fmtBRL(Number(contract.rubrica_remaining_after || 0))]);
    }
    autoTable(doc, {
      startY: 90,
      head: [],
      body: apprRows,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 170 } },
      margin: { left: margin, right: margin },
    });

    // ===== FOOTER on every page =====
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      const footer = `Documento gerado automaticamente em ${format(generatedAt, "dd/MM/yyyy HH:mm")} por ${profile?.name || "—"} — Sistema MetricOss`;
      doc.text(footer, margin, pageH - 20);
      doc.text(`Página ${i} de ${total}`, pageW - margin, pageH - 20, { align: "right" });
    }

    doc.save(`Dossie_OC_${order.numero || "sem-numero"}_${format(generatedAt, "yyyyMMdd")}.pdf`);
  };

  const order = dossier?.order;
  const invites = dossier?.invites || [];
  const suppliers = dossier?.quote_suppliers || [];
  const approvals = dossier?.approvals || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Dossiê de Auditoria — OC {order?.numero || "..."}</DialogTitle>
          <DialogDescription>
            Documento completo do processo, pronto para envio ao Tribunal de Contas.
          </DialogDescription>
        </DialogHeader>

        {loading && <div className="py-12 text-center text-muted-foreground">Carregando dossiê...</div>}

        {!loading && dossier && (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-muted-foreground">Unidade</div><div className="font-medium">{order?.facility_unit}</div></div>
                  <div><div className="text-muted-foreground">Fornecedor</div><div className="font-medium">{order?.fornecedor_nome}</div></div>
                  <div><div className="text-muted-foreground">Valor total</div><div className="font-medium">{fmtBRL(Number(order?.valor_total || 0))}</div></div>
                  <div><div className="text-muted-foreground">Status</div><div><Badge variant="outline">{order?.status}</Badge></div></div>
                  <div><div className="text-muted-foreground">Emitida em</div><div className="font-medium">{fmtDateTime(order?.created_at)}</div></div>
                  <div><div className="text-muted-foreground">Aprovada em</div><div className="font-medium">{fmtDateTime(order?.aprovado_em)}</div></div>
                </CardContent>
              </Card>

              <div>
                <h3 className="font-semibold mb-2">Convites e respostas ({invites.length})</h3>
                <div className="space-y-1 text-xs">
                  {invites.map((iv: any) => (
                    <div key={iv.id} className="border rounded-md p-2">
                      <div className="font-medium">{iv.fornecedor_nome} <span className="text-muted-foreground">— {iv.fornecedor_cnpj || "sem CNPJ"}</span></div>
                      <div className="text-muted-foreground">
                        Enviado: {fmtDateTime(iv.created_at)} • Respondido: {fmtDateTime(iv.submitted_at)} • IP: {iv.submission_ip || "não capturado"}
                      </div>
                      {iv.responder_name && (
                        <div className="text-muted-foreground">
                          Respondente: <span className="font-medium text-foreground">{iv.responder_name}</span>
                          {" • "}{iv.responder_email || "—"}
                          {" • Tel "}{iv.responder_phone || "—"}
                          {iv.responder_cpf ? <> • CPF {iv.responder_cpf}</> : null}
                        </div>
                      )}
                      <div className="mt-1 break-all">
                        <span className="text-muted-foreground">Link público: </span>
                        <a
                          href={`${window.location.origin}/cotacao-publica/${iv.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          {`${window.location.origin}/cotacao-publica/${iv.id}`}
                        </a>
                      </div>
                    </div>
                  ))}
                  {invites.length === 0 && <div className="text-muted-foreground">Sem convites registrados.</div>}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Fornecedores na cotação ({suppliers.length})</h3>
                <div className="space-y-1 text-xs">
                  {suppliers.map((s: any) => (
                    <div key={s.id} className="border rounded-md p-2 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{s.fornecedor_nome} <span className="text-muted-foreground">— {s.fornecedor_cnpj || "—"}</span></div>
                        <div className="text-muted-foreground">Origem: {s.fonte === "invite_link" ? "Link público" : "Manual"} • IP: {s.submission_ip || "—"}</div>
                      </div>
                      <div className="font-medium">{fmtBRL(Number(s.total || 0))}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Aprovações ({approvals.length})</h3>
                <div className="space-y-1 text-xs">
                  {approvals.map((a: any) => (
                    <div key={a.id} className="border rounded-md p-2">
                      <div className="font-medium">{a.approver_name || "—"} <span className="text-muted-foreground">— {a.approver_cargo || "—"}</span></div>
                      <div className="text-muted-foreground">
                        Decisão: <strong>{a.decision || "—"}</strong> • {fmtDateTime(a.signed_at)} • IP: {a.approver_ip || "—"} • LGPD: {a.ciencia_lgpd ? "Sim" : "Não"}
                      </div>
                    </div>
                  ))}
                  {approvals.length === 0 && <div className="text-muted-foreground">Sem aprovações registradas.</div>}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button className="rounded-full" onClick={generatePDF} disabled={!dossier || loading}>
            Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function sectionTitle(doc: jsPDF, title: string, margin: number) {
  doc.setFillColor(13, 79, 79);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, margin, 38);
  doc.setTextColor(0, 0, 0);
}