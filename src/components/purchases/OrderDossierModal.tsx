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
    const footerReserve = 40; // rodapé fica em pageH-20, então 40pt é seguro
    const sectionHeaderH = 44; // altura da faixa teal de seção (mais compacta)
    const contentStartY = sectionHeaderH + 18; // respiro pequeno após faixa
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

    // Helpers de layout
    const lastY = () => (doc as any).lastAutoTable?.finalY ?? contentStartY;
    const ensureSpace = (needed: number, currentY?: number): number => {
      const y = currentY ?? lastY();
      if (y + needed > pageH - footerReserve) {
        doc.addPage();
        return contentStartY;
      }
      return y;
    };
    const subTitle = (text: string, gapBefore = 14) => {
      const y = ensureSpace(gapBefore + 16);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(13, 79, 79);
      doc.text(text, margin, y + gapBefore);
      doc.setTextColor(0, 0, 0);
      return y + gapBefore + 4;
    };
    // Inicia uma seção: nova página apenas se não houver espaço útil; pinta faixa compacta
    const startSection = (title: string, minNeeded = 140, forceNewPage = false) => {
      const y = lastY();
      const needsNewPage = forceNewPage || y === contentStartY ? false : (y + minNeeded > pageH - footerReserve);
      // Se ainda não desenhou nada na página corrente além da capa, addPage se for a 1ª seção (cover)
      if (forceNewPage || needsNewPage) {
        doc.addPage();
      }
      // Pinta a faixa teal compacta
      doc.setFillColor(13, 79, 79);
      doc.rect(0, 0, pageW, sectionHeaderH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(title, margin, 28);
      doc.setTextColor(0, 0, 0);
      return contentStartY;
    };

    // ===== COVER =====
    doc.setFillColor(13, 79, 79); // teal
    doc.rect(0, 0, pageW, 110, "F");
    try {
      // Logo Instituto Univida — proporção nativa 300x164 (~1.829:1)
      const logoH = 60;
      const logoW = logoH * (300 / 164); // mantém proporção real
      const logoX = pageW - margin - logoW;
      const logoY = (110 - logoH) / 2;
      doc.addImage(UNIVIDA_LOGO_BASE64, "PNG", logoX, logoY, logoW, logoH, undefined, "FAST");
    } catch (_) {}
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("DOSSIÊ DE AUDITORIA", margin, 46);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Ordem de Compra — Pronto para Tribunal de Contas", margin, 66);
    doc.text("Instituto Univida — Sistema MetricOss (Moss)", margin, 82);

    doc.setTextColor(0, 0, 0);
    let y = 138;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`OC ${order.numero || "—"}`, margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

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
      styles: { fontSize: 9, cellPadding: 2.5, minCellHeight: 12 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 160 } },
      margin: { left: margin, right: margin },
      pageBreak: "auto",
    });

    // ===== SECTION 1: TIMELINE =====
    startSection("Seção 1 — Histórico do processo (linha do tempo)", 200, true);
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
      startY: contentStartY,
      head: [["Data/Hora", "Evento"]],
      body: timeline,
      theme: "striped",
      headStyles: { fillColor: [13, 79, 79], textColor: 255, fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2.5, minCellHeight: 10, valign: "top" },
      columnStyles: { 0: { cellWidth: 100 } },
      margin: { left: margin, right: margin, top: 30, bottom: footerReserve },
      pageBreak: "auto",
      rowPageBreak: "avoid",
    });

    // ===== SECTION 2: PRICE GRID =====
    startSection("Seção 2 — Grade comparativa de preços", 220);

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
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Nenhuma proposta de fornecedor registrada para esta OC.", margin, contentStartY + 12);
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
        startY: contentStartY,
        head: [head],
        body,
        theme: "grid",
        headStyles: { fillColor: [13, 79, 79], textColor: 255, fontSize: 7, halign: "center" },
        styles: { fontSize: 7, cellPadding: 2, valign: "middle", minCellHeight: 10 },
        columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 50 } },
        margin: { left: margin, right: margin, top: 30, bottom: footerReserve },
        pageBreak: "auto",
        rowPageBreak: "avoid",
      });
    }

    const y2 = subTitle("Log de preenchimento dos fornecedores", 16);
    autoTable(doc, {
      startY: y2,
      head: [["Fornecedor", "CNPJ", "Origem", "Data/Hora envio", "IP", "Respondente (nome / e-mail / cel / CPF)", "Link público enviado"]],
      body: suppliers.map((s) => {
        const inv = invites.find((i) => i.fornecedor_cnpj === s.fornecedor_cnpj || i.fornecedor_nome === s.fornecedor_nome);
        const link = inv?.id
          ? `${window.location.origin}/cotacao-publica/${inv.id}`
          : "—";
        const respondente = inv?.responder_name
          ? `${inv.responder_name}\n${inv.responder_email || "—"}\nTel: ${inv.responder_phone || "—"}${inv.responder_cpf ? `\nCPF: ${inv.responder_cpf}` : ""}`
          : "—";
        return [
          s.fornecedor_nome,
          s.fornecedor_cnpj || "—",
          s.fonte === "invite_link" ? "Link público" : "Manual",
          fmtDateTime(inv?.submitted_at || s.created_at),
          s.submission_ip || inv?.submission_ip || "não capturado",
          respondente,
          link,
        ];
      }),
      theme: "striped",
      headStyles: { fillColor: [13, 79, 79], textColor: 255, fontSize: 7, halign: "center" },
      styles: { fontSize: 6.5, cellPadding: 2, valign: "top", overflow: "linebreak", minCellHeight: 10 },
      columnStyles: { 5: { cellWidth: 95 }, 6: { cellWidth: 110, textColor: [13, 79, 79] } },
      margin: { left: margin, right: margin, top: 30, bottom: footerReserve },
      pageBreak: "auto",
      rowPageBreak: "avoid",
    });

    // Tabela complementar: TODOS os convites enviados (mesmo sem resposta)
    if (invites.length > 0) {
      const y3 = subTitle("Convites enviados aos fornecedores (rastreabilidade completa)", 14);
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
        headStyles: { fillColor: [13, 79, 79], textColor: 255, fontSize: 6, halign: "center" },
        styles: { fontSize: 6, cellPadding: 1.5, valign: "top", overflow: "linebreak", minCellHeight: 9 },
        columnStyles: { 6: { cellWidth: 95 }, 8: { cellWidth: 95, textColor: [13, 79, 79] } },
        margin: { left: margin, right: margin, top: 30, bottom: footerReserve },
        pageBreak: "auto",
        rowPageBreak: "avoid",
      });
    }

    // ===== SECTION 3: ITEMS =====
    startSection("Seção 3 — Itens comprados", 160);
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
      startY: contentStartY,
      head: [["#", "Código", "Descrição", "Qtd", "V. unit.", "Total", "Setor"]],
      body: itemsBody,
      theme: "grid",
      headStyles: { fillColor: [13, 79, 79], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2.5, minCellHeight: 12, valign: "top" },
      columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 70 } },
      margin: { left: margin, right: margin, top: 30, bottom: footerReserve },
      pageBreak: "auto",
      rowPageBreak: "avoid",
    });

    // ===== SECTION 4: APPROVAL =====
    startSection("Seção 4 — Aprovação e rastreabilidade legal", 220);
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
      startY: contentStartY,
      head: [],
      body: apprRows,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2.5, minCellHeight: 12, valign: "top" },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 170 } },
      margin: { left: margin, right: margin, top: 30, bottom: footerReserve },
      pageBreak: "auto",
      rowPageBreak: "avoid",
    });

    // ===== SECTION 5: JUSTIFICATIVA LEGAL (Dispensa / Inexigibilidade / Emergencial) =====
    if (req && ["dispensa", "inexigibilidade", "emergencial"].includes(req.justificativa_tipo || "")) {
      const rawObs: string = req.observacoes || "";
      const blockMatch = rawObs.match(/\[JUST_LEGAL\]([\s\S]*?)\[\/JUST_LEGAL\]/);
      let legal: any = null;
      if (blockMatch) {
        try { legal = JSON.parse(blockMatch[1]); } catch { /* ignore */ }
      }
      const tipoLabel =
        req.justificativa_tipo === "dispensa" ? "Dispensa"
        : req.justificativa_tipo === "inexigibilidade" ? "Inexigibilidade"
        : "Compra emergencial";

      startSection(`Seção 5 — Justificativa legal (${tipoLabel})`, 200);
      const legalRows: any[] = [
        ["Modalidade", tipoLabel],
        ["Base legal (Lei 14.133/2021)", legal?.base_legal || "—"],
        ["Nº processo administrativo", legal?.processo_numero || "—"],
        ["Fundamentação técnica", legal?.fundamentacao || "—"],
      ];
      if (req.justificativa_tipo === "inexigibilidade") {
        legalRows.push(["Comprovação de exclusividade", legal?.fornecedor_unico || "—"]);
      }
      if (req.justificativa_tipo === "dispensa") {
        legalRows.push(["Comparativo / pesquisa de preços", legal?.fornecedor_unico || "—"]);
      }
      if (req.justificativa_tipo === "emergencial") {
        legalRows.push(["Descrição do risco / dano potencial", legal?.risco_descricao || "—"]);
        legalRows.push(["Prazo máximo (urgência)", legal?.urgencia_prazo || "—"]);
        legalRows.push(["Justificativa técnica (fato gerador)", legal?.fato_gerador || "—"]);
      }
      legalRows.push(["Impacto se NÃO comprar", legal?.impacto_nao_compra || "—"]);
      const riscos = [
        ...(Array.isArray(legal?.riscos_classif) ? legal.riscos_classif : []),
        ...(legal?.risco_outro ? [`Outro: ${legal.risco_outro}`] : []),
      ];
      legalRows.push(["Classificação do risco", riscos.length ? riscos.map((r: string) => `• ${r}`).join("\n") : "—"]);
      legalRows.push(["Pesquisa de preço simplificada", legal?.pesquisa_preco || "—"]);
      legalRows.push(["Justificativa da escolha do fornecedor", legal?.escolha_fornecedor || "—"]);
      const reg = Array.isArray(legal?.regularizacao) ? legal.regularizacao : [];
      legalRows.push(["Regularização documental", reg.length ? reg.map((r: string) => `☑ ${r}`).join("\n") : "—"]);
      const reinc = [
        ...(Array.isArray(legal?.reincidencia) ? legal.reincidencia : []),
        ...(legal?.reincidencia_outro ? [`Outro: ${legal.reincidencia_outro}`] : []),
      ];
      legalRows.push(["Análise de reincidência", reinc.length ? reinc.map((r: string) => `• ${r}`).join("\n") : "—"]);
      legalRows.push(["Plano de ação (medidas corretivas)", legal?.plano_acao || "—"]);
      legalRows.push(["Responsável pela implementação", legal?.plano_responsavel || "—"]);
      legalRows.push(["Prazo do plano de ação", legal?.plano_prazo || "—"]);
      autoTable(doc, {
        startY: contentStartY,
        head: [],
        body: legalRows,
        theme: "plain",
        styles: { fontSize: 8.5, cellPadding: 2.5, minCellHeight: 12, valign: "top" },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 200, fillColor: [240, 246, 246] } },
        margin: { left: margin, right: margin, top: 30, bottom: footerReserve },
        pageBreak: "auto",
        rowPageBreak: "avoid",
      });
    }

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
  const req = dossier?.requisition;
  const legalPreview: any = (() => {
    if (!req || !["dispensa", "inexigibilidade", "emergencial"].includes(req.justificativa_tipo || "")) return null;
    const m = (req.observacoes || "").match(/\[JUST_LEGAL\]([\s\S]*?)\[\/JUST_LEGAL\]/);
    if (!m) return { tipo: req.justificativa_tipo };
    try { return { tipo: req.justificativa_tipo, ...JSON.parse(m[1]) }; } catch { return { tipo: req.justificativa_tipo }; }
  })();

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

              {legalPreview && (
                <div>
                  <h3 className="font-semibold mb-2">
                    Justificativa legal —{" "}
                    {legalPreview.tipo === "dispensa" && "Dispensa"}
                    {legalPreview.tipo === "inexigibilidade" && "Inexigibilidade"}
                    {legalPreview.tipo === "emergencial" && "Compra emergencial"}
                  </h3>
                  <div className="border rounded-md p-3 text-xs space-y-2 bg-primary/5">
                    <div><span className="text-muted-foreground">Base legal: </span><span className="font-medium">{legalPreview.base_legal || "—"}</span></div>
                    <div><span className="text-muted-foreground">Processo administrativo: </span><span className="font-medium">{legalPreview.processo_numero || "—"}</span></div>
                    {legalPreview.fundamentacao && (
                      <div><div className="text-muted-foreground">Fundamentação técnica:</div><div>{legalPreview.fundamentacao}</div></div>
                    )}
                    {legalPreview.impacto_nao_compra && (
                      <div><div className="text-muted-foreground">Impacto se NÃO comprar:</div><div>{legalPreview.impacto_nao_compra}</div></div>
                    )}
                    {Array.isArray(legalPreview.riscos_classif) && legalPreview.riscos_classif.length > 0 && (
                      <div>
                        <div className="text-muted-foreground">Classificação do risco:</div>
                        <ul className="list-disc list-inside">
                          {legalPreview.riscos_classif.map((r: string) => <li key={r}>{r}</li>)}
                          {legalPreview.risco_outro && <li>Outro: {legalPreview.risco_outro}</li>}
                        </ul>
                      </div>
                    )}
                    {legalPreview.plano_acao && (
                      <div>
                        <div className="text-muted-foreground">Plano de ação para evitar recorrência:</div>
                        <div>{legalPreview.plano_acao}</div>
                        <div className="text-muted-foreground mt-1">
                          Responsável: <span className="text-foreground">{legalPreview.plano_responsavel || "—"}</span> • Prazo: <span className="text-foreground">{legalPreview.plano_prazo || "—"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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