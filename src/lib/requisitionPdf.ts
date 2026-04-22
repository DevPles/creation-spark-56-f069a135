import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy");
  } catch {
    return "—";
  }
};

const fmtDateTime = (d?: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy HH:mm"); } catch { return "—"; }
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const REQ_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_cotacao: "Aguardando cotação",
  em_cotacao: "Em cotação",
  cotacao_concluida: "Cotação concluída",
  em_oc: "Em ordem de compra",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

// Paleta azul corporativa
const NAVY: [number, number, number] = [11, 47, 99];     // header escuro
const BLUE: [number, number, number] = [29, 78, 156];    // títulos / tabela header
const SOFT_BLUE: [number, number, number] = [219, 232, 248]; // headers de campos
const ALT_ROW: [number, number, number] = [243, 247, 252]; // zebra
const BORDER_BLUE: [number, number, number] = [180, 202, 230];
const TEXT_DARK: [number, number, number] = [20, 32, 56];
const TEXT_MUTED: [number, number, number] = [90, 105, 130];

export async function generateRequisitionPdf(requisitionId: string) {
  const { data: req, error: reqErr } = await supabase
    .from("purchase_requisitions")
    .select("*")
    .eq("id", requisitionId)
    .maybeSingle();
  if (reqErr || !req) throw new Error("Requisição não encontrada");

  const { data: items } = await supabase
    .from("purchase_requisition_items")
    .select("*")
    .eq("requisition_id", requisitionId)
    .order("item_num", { ascending: true });

  // Dados complementares para enriquecer o documento
  const [quotationsRes, invitesRes, ordersRes] = await Promise.all([
    supabase.from("purchase_quotations").select("*").eq("requisition_id", requisitionId),
    (supabase as any).from("quotation_invites").select("*").eq("requisition_id", requisitionId),
    supabase.from("purchase_orders").select("*").eq("requisition_id", requisitionId),
  ]);
  const quotations = quotationsRes.data || [];
  const invites = invitesRes.data || [];
  const orders = ordersRes.data || [];

  const totalItens = (items || []).reduce((s: number, it: any) => s + Number(it.quantidade || 0), 0);
  const linhasItens = (items || []).length;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  const ensureSpace = (needed: number, currentY: number) => {
    if (currentY + needed > pageH - 60) {
      doc.addPage();
      drawHeaderBand(false);
      return 110;
    }
    return currentY;
  };

  const drawHeaderBand = (full: boolean) => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, full ? 88 : 60, "F");
    // Faixa de acento
    doc.setFillColor(...BLUE);
    doc.rect(0, full ? 88 : 60, pageW, 4, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(full ? 16 : 12);
    doc.text("REQUISIÇÃO DE COMPRA", margin, full ? 34 : 26);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(full ? 10 : 9);
    doc.text(`Nº ${req.numero || "—"}`, margin, full ? 56 : 44);
    if (full) {
      doc.text(req.facility_unit || "—", margin, 74);
    }
    doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageW - margin, full ? 56 : 44, { align: "right" });
    if (full) {
      doc.text(`Status: ${REQ_STATUS_LABEL[req.status] || req.status || "—"}`, pageW - margin, 74, { align: "right" });
    }
    doc.setTextColor(...TEXT_DARK);
  };

  drawHeaderBand(true);
  let y = 110;

  const sectionTitle = (title: string) => {
    y = ensureSpace(28, y);
    doc.setFillColor(...BLUE);
    doc.rect(margin, y - 12, 4, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BLUE);
    doc.text(title.toUpperCase(), margin + 10, y);
    doc.setTextColor(...TEXT_DARK);
    y += 8;
  };

  // ===== KPIs em cartões =====
  const kpis = [
    { label: "Itens", value: String(linhasItens) },
    { label: "Qtd. total", value: String(totalItens) },
    { label: "Cotações", value: String(quotations.length) },
    { label: "Convites", value: String(invites.length) },
    { label: "Ordens de compra", value: String(orders.length) },
  ];
  const kpiW = (pageW - margin * 2 - 8 * (kpis.length - 1)) / kpis.length;
  const kpiH = 46;
  kpis.forEach((k, i) => {
    const x = margin + i * (kpiW + 8);
    doc.setFillColor(...SOFT_BLUE);
    doc.setDrawColor(...BORDER_BLUE);
    doc.roundedRect(x, y, kpiW, kpiH, 4, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...NAVY);
    doc.text(k.value, x + kpiW / 2, y + 22, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(k.label, x + kpiW / 2, y + 36, { align: "center" });
  });
  y += kpiH + 18;
  doc.setTextColor(...TEXT_DARK);

  // ===== Dados gerais (duas colunas) =====
  sectionTitle("Dados gerais");
  const leftRows: [string, string][] = [
    ["Nº da Requisição", req.numero || "—"],
    ["Data da Requisição", fmtDate(req.data_requisicao)],
    ["Unidade", req.facility_unit || "—"],
    ["Município", req.municipio || "—"],
    ["Setor", req.setor || "—"],
    ["Classificação", (req.classificacao || []).join(", ") || "—"],
  ];
  const rightRows: [string, string][] = [
    ["Solicitante", req.solicitante_nome || "—"],
    ["Aprovador imediato", req.aprovador_imediato_nome || "—"],
    ["Aprovador da diretoria", req.aprovador_diretoria_nome || "—"],
    ["Justificativa / tipo", req.justificativa_tipo || "—"],
    ["Criada em", fmtDateTime(req.created_at)],
    ["Atualizada em", fmtDateTime(req.updated_at)],
  ];

  const colWidth = (pageW - margin * 2 - 12) / 2;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5, lineColor: BORDER_BLUE, textColor: TEXT_DARK },
    headStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    head: [["Campo", "Valor"]],
    body: leftRows,
    margin: { left: margin, right: margin + colWidth + 12 },
    tableWidth: colWidth,
    columnStyles: { 0: { cellWidth: 110, fontStyle: "bold", textColor: NAVY } },
  });
  const leftEnd = (doc as any).lastAutoTable.finalY;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5, lineColor: BORDER_BLUE, textColor: TEXT_DARK },
    headStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    head: [["Campo", "Valor"]],
    body: rightRows,
    margin: { left: margin + colWidth + 12, right: margin },
    tableWidth: colWidth,
    columnStyles: { 0: { cellWidth: 110, fontStyle: "bold", textColor: NAVY } },
  });
  const rightEnd = (doc as any).lastAutoTable.finalY;
  y = Math.max(leftEnd, rightEnd) + 16;

  // ===== Itens =====
  sectionTitle("Itens solicitados");
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 5, lineColor: BORDER_BLUE, textColor: TEXT_DARK },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    head: [["#", "Descrição", "Qtd", "Unid.", "Observação"]],
    body: (items || []).map((it: any) => [
      String(it.item_num ?? ""),
      it.descricao || "—",
      String(it.quantidade ?? ""),
      it.unidade_medida || "—",
      it.observacao || "",
    ]),
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 30, halign: "right" },
      2: { cellWidth: 50, halign: "right" },
      3: { cellWidth: 60, halign: "center" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Convites a fornecedores =====
  if (invites.length) {
    sectionTitle("Convites a fornecedores");
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: BORDER_BLUE, textColor: TEXT_DARK },
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW },
      head: [["Fornecedor", "CNPJ", "E-mail", "Status", "Enviado", "Respondido"]],
      body: invites.map((i: any) => [
        i.fornecedor_nome || "—",
        i.fornecedor_cnpj || "—",
        i.fornecedor_email || "—",
        i.submitted_at ? "Respondido" : (i.status || "pendente"),
        fmtDate(i.created_at),
        i.submitted_at ? fmtDateTime(i.submitted_at) : "—",
      ]),
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // ===== Cotações vinculadas =====
  if (quotations.length) {
    sectionTitle("Cotações vinculadas");
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: BORDER_BLUE, textColor: TEXT_DARK },
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW },
      head: [["Nº", "Data", "Setor comprador", "Fornecedor vencedor", "Total vencedor", "Status"]],
      body: quotations.map((q: any) => [
        q.numero || "—",
        fmtDate(q.data_cotacao),
        q.setor_comprador || "—",
        q.winner_supplier || "—",
        fmtBRL(Number(q.total_winner || 0)),
        q.status || "—",
      ]),
      margin: { left: margin, right: margin },
      columnStyles: { 4: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // ===== Ordens de compra =====
  if (orders.length) {
    sectionTitle("Ordens de compra geradas");
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: BORDER_BLUE, textColor: TEXT_DARK },
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW },
      head: [["Nº", "Fornecedor", "CNPJ", "Valor total", "Status", "Aprovada em"]],
      body: orders.map((o: any) => [
        o.numero || "—",
        o.fornecedor_nome || "—",
        o.fornecedor_cnpj || "—",
        fmtBRL(Number(o.valor_total || 0)),
        o.status || "—",
        fmtDateTime(o.aprovado_em),
      ]),
      margin: { left: margin, right: margin },
      columnStyles: { 3: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // ===== Observações =====
  if (req.observacoes) {
    sectionTitle("Observações");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(req.observacoes, pageW - margin * 2);
    y = ensureSpace(lines.length * 12 + 10, y);
    doc.setFillColor(...ALT_ROW);
    doc.setDrawColor(...BORDER_BLUE);
    doc.roundedRect(margin, y - 4, pageW - margin * 2, lines.length * 12 + 14, 3, 3, "FD");
    doc.text(lines, margin + 8, y + 8);
    y += lines.length * 12 + 18;
  }

  // ===== Assinaturas =====
  y = ensureSpace(120, y);
  y = Math.max(y + 30, pageH - 130);
  const colW = (pageW - margin * 2 - 30) / 2;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(margin, y, margin + colW, y);
  doc.line(margin + colW + 30, y, pageW - margin, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(req.aprovador_imediato_nome || "Aprovador imediato", margin + colW / 2, y + 14, { align: "center" });
  doc.text(req.aprovador_diretoria_nome || "Aprovador da diretoria", margin + colW + 30 + colW / 2, y + 14, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Aprovação imediata", margin + colW / 2, y + 26, { align: "center" });
  doc.text("Aprovação da diretoria", margin + colW + 30 + colW / 2, y + 26, { align: "center" });

  // ===== Rodapé com paginação =====
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BORDER_BLUE);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 36, pageW - margin, pageH - 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Requisição ${req.numero || ""} • ${req.facility_unit || ""}`, margin, pageH - 22);
    doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 22, { align: "right" });
  }

  doc.save(`requisicao-${req.numero || requisitionId}.pdf`);
}