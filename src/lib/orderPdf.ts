import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { UNIVIDA_LOGO_BASE64 } from "@/assets/univida-logo-base64";

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return "—"; }
};
const fmtDateTime = (d?: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy HH:mm"); } catch { return "—"; }
};
const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const OC_STATUS_LABEL: Record<string, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  autorizada: "Autorizada",
  negada: "Negada",
  enviada: "Enviada ao fornecedor",
  recebida: "Recebida",
  cancelada: "Cancelada",
};

// Paleta azul corporativa (igual cotação/requisição)
const NAVY: [number, number, number] = [11, 47, 99];
const BLUE: [number, number, number] = [29, 78, 156];
const SOFT_BLUE: [number, number, number] = [219, 232, 248];
const ALT_ROW: [number, number, number] = [243, 247, 252];
const BORDER_BLUE: [number, number, number] = [180, 202, 230];
const TEXT_DARK: [number, number, number] = [20, 32, 56];
const TEXT_MUTED: [number, number, number] = [90, 105, 130];

export async function generateOrderPdf(
  orderId: string,
  options?: { returnBlob?: boolean }
): Promise<Blob | void> {
  const { data: order, error: oErr } = await (supabase as any)
    .from("purchase_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (oErr || !order) throw new Error("Ordem de compra não encontrada");

  const [itemsRes, reqRes, quotRes, contractRes, approvalsRes, reqItemsRes, quotSuppliersRes] = await Promise.all([
    (supabase as any)
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", orderId)
      .order("item_num", { ascending: true }),
    order.requisition_id
      ? supabase.from("purchase_requisitions").select("*").eq("id", order.requisition_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    order.quotation_id
      ? supabase.from("purchase_quotations").select("*").eq("id", order.quotation_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    order.contract_id
      ? supabase.from("contracts").select("*").eq("id", order.contract_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    (supabase as any)
      .from("purchase_order_approvals")
      .select("*")
      .eq("purchase_order_id", orderId)
      .order("created_at", { ascending: false }),
    order.requisition_id
      ? (supabase as any)
          .from("purchase_requisition_items")
          .select("*")
          .eq("requisition_id", order.requisition_id)
      : Promise.resolve({ data: [] } as any),
    order.quotation_id
      ? (supabase as any)
          .from("purchase_quotation_suppliers")
          .select("*")
          .eq("quotation_id", order.quotation_id)
      : Promise.resolve({ data: [] } as any),
  ]);

  const items = (itemsRes as any).data || [];
  const req = (reqRes as any).data || null;
  const quot = (quotRes as any).data || null;
  const contract = (contractRes as any).data || null;
  const approvals = (approvalsRes as any).data || [];
  const lastApproval = approvals[0] || null;
  const reqItems = (reqItemsRes as any).data || [];
  const quotSuppliers = (quotSuppliersRes as any).data || [];

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  (doc as any).setCharSpace(0);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  const drawHeaderBand = (full: boolean) => {
    // Banner mais alto para acomodar duas colunas sem encostar no logo
    const bandH = full ? 110 : 70;
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, bandH, "F");
    doc.setFillColor(...BLUE);
    doc.rect(0, bandH, pageW, 4, "F");

    // Logo com área reservada — calcula a "zona segura" à esquerda dele
    const logoH = full ? 56 : 38;
    const logoW = logoH * 1.6;
    const logoMargin = 14; // respiração entre texto e logo
    const logoX = pageW - margin - logoW;
    const logoY = (bandH - logoH) / 2;
    try {
      doc.addImage(UNIVIDA_LOGO_BASE64, "PNG", logoX, logoY, logoW, logoH, undefined, "FAST");
    } catch {/* ignore */}

    // Limite máximo onde os textos da direita podem chegar (não invadem o logo)
    const rightTextLimit = logoX - logoMargin;

    doc.setTextColor(255, 255, 255);
    (doc as any).setCharSpace(0);

    // ----- Coluna esquerda -----
    doc.setFont("helvetica", "bold");
    doc.setFontSize(full ? 18 : 13);
    doc.text("ORDEM DE COMPRA", margin, full ? 30 : 24);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(full ? 10 : 9);
    const ocLine = `No. ${order.numero || "-"}`;
    const reqLine = req?.numero ? `Requisição: ${req.numero}` : null;
    doc.text(ocLine, margin, full ? 50 : 42);

    if (full) {
      // Linha 3 esquerda: requisição (se houver) + unidade
      if (reqLine) {
        doc.text(reqLine, margin, 68);
        doc.text(order.facility_unit || "-", margin, 86);
      } else {
        doc.text(order.facility_unit || "-", margin, 68);
      }

      // ----- Coluna direita (alinhada ao limite seguro do logo) -----
      doc.text(
        `Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        rightTextLimit,
        50,
        { align: "right" }
      );
      doc.text(
        `Status: ${OC_STATUS_LABEL[order.status] || order.status || "-"}`,
        rightTextLimit,
        68,
        { align: "right" }
      );
      if (order.aprovado_em) {
        doc.text(
          `Aprovada em ${fmtDateTime(order.aprovado_em)}`,
          rightTextLimit,
          86,
          { align: "right" }
        );
      }
    } else {
      // Header reduzido nas páginas seguintes
      if (reqLine) {
        doc.text(reqLine, margin, 60);
      }
      doc.text(
        `Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        rightTextLimit,
        42,
        { align: "right" }
      );
    }
    doc.setTextColor(...TEXT_DARK);
  };

  const ensureSpace = (needed: number, currentY: number) => {
    if (currentY + needed > pageH - 60) {
      doc.addPage();
      drawHeaderBand(false);
      return 96; // banda reduzida = 70 + 4 + ~22 de respiração
    }
    return currentY;
  };

  drawHeaderBand(true);
  let y = 138; // banda completa = 110 + 4 + ~24 de respiração

  const sectionTitle = (title: string) => {
    y = ensureSpace(28, y);
    (doc as any).setCharSpace(0);
    doc.setFillColor(...BLUE);
    doc.rect(margin, y - 12, 4, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BLUE);
    doc.text(title.toUpperCase(), margin + 10, y);
    doc.setTextColor(...TEXT_DARK);
    y += 8;
  };

  // Hook para garantir charSpace=0 em TODAS as células (corrige glitch "C am po")
  const fixCharSpace = {
    didParseCell: (data: any) => {
      // sem-op: hook didDrawCell faz o trabalho real
    },
    didDrawPage: () => { (doc as any).setCharSpace(0); },
    willDrawCell: () => { (doc as any).setCharSpace(0); },
  };
  const baseTableStyles = {
    font: "helvetica",
    fontSize: 9,
    cellPadding: 5,
    lineColor: BORDER_BLUE,
    textColor: TEXT_DARK,
    overflow: "linebreak" as const,
  };

  // ===== KPIs =====
  const totalItens = items.reduce((acc: number, it: any) => acc + Number(it.quantidade || 0), 0);
  const kpis = [
    { label: "Itens", value: String(items.length) },
    { label: "Quantidade total", value: String(totalItens) },
    { label: "Valor total", value: fmtBRL(Number(order.valor_total || 0)) },
    { label: "Status", value: OC_STATUS_LABEL[order.status] || order.status || "—" },
  ];
  const kpiW = (pageW - margin * 2 - 8 * (kpis.length - 1)) / kpis.length;
  const kpiH = 46;
  kpis.forEach((k, i) => {
    const x = margin + i * (kpiW + 8);
    doc.setFillColor(...SOFT_BLUE);
    doc.setDrawColor(...BORDER_BLUE);
    doc.roundedRect(x, y, kpiW, kpiH, 4, 4, "FD");
    (doc as any).setCharSpace(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    const valueLines = doc.splitTextToSize(k.value, kpiW - 12);
    doc.text(valueLines[0] || "—", x + kpiW / 2, y + 22, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(k.label, x + kpiW / 2, y + 36, { align: "center" });
  });
  y += kpiH + 18;
  doc.setTextColor(...TEXT_DARK);

  // ===== Dados gerais =====
  sectionTitle("Dados gerais");
  const reqItemsCount = reqItems.length;
  const reqItemsQty = reqItems.reduce((acc: number, it: any) => acc + Number(it.quantidade || 0), 0);
  const leftRows: [string, string][] = [
    ["Nº da OC", order.numero || "—"],
    ["Unidade", order.facility_unit || "—"],
    ["Município", req?.municipio || "—"],
    ["Setor solicitante", req?.setor || "—"],
    ["Solicitante", req?.solicitante_nome || "—"],
    ["Aprovador imediato", req?.aprovador_imediato_nome || "—"],
    ["Aprovador diretoria", req?.aprovador_diretoria_nome || "—"],
  ];
  const rightRows: [string, string][] = [
    ["Contrato", contract?.name || "—"],
    ["Rubrica", order.rubrica_name || "—"],
    ["Data de emissão da OC", fmtDate(order.created_at)],
    ["Data envio ao setor", fmtDate(order.data_envio_setor)],
    ["Data envio ao fornecedor", fmtDate(order.data_envio_fornecedor)],
    ["Prazo de entrega", order.prazo_entrega ? `${order.prazo_entrega}` : "—"],
    ["Status atual", OC_STATUS_LABEL[order.status] || order.status || "—"],
  ];
  const colWidth = (pageW - margin * 2 - 12) / 2;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: baseTableStyles,
    headStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    head: [["Campo", "Valor"]],
    body: leftRows,
    margin: { left: margin, right: margin + colWidth + 12 },
    tableWidth: colWidth,
    columnStyles: { 0: { cellWidth: 140, fontStyle: "bold", textColor: NAVY } },
    rowPageBreak: "avoid",
    ...fixCharSpace,
  });
  const leftEnd = (doc as any).lastAutoTable.finalY;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: baseTableStyles,
    headStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    head: [["Campo", "Valor"]],
    body: rightRows,
    margin: { left: margin + colWidth + 12, right: margin },
    tableWidth: colWidth,
    columnStyles: { 0: { cellWidth: 150, fontStyle: "bold", textColor: NAVY } },
    rowPageBreak: "avoid",
    ...fixCharSpace,
  });
  const rightEnd = (doc as any).lastAutoTable.finalY;
  y = Math.max(leftEnd, rightEnd) + 16;

  // ===== Vínculos (Requisição / Cotação / Contrato) =====
  sectionTitle("Vínculos");
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: baseTableStyles,
    headStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    head: [["Origem", "Identificação", "Detalhes"]],
    body: [
      [
        "Requisição de compra",
        req?.numero || "—",
        req
          ? `Data: ${fmtDate(req.data_requisicao)} • Itens: ${reqItemsCount} • Qtd total: ${reqItemsQty}` +
            (req.justificativa_tipo ? ` • Justificativa: ${req.justificativa_tipo}` : "")
          : "—",
      ],
      [
        "Cotação (mapa)",
        quot?.numero || "—",
        quot
          ? `Data: ${fmtDate(quot.data_cotacao)} • Fornecedores: ${quotSuppliers.length}` +
            (quot.winner_supplier ? ` • Vencedor: ${quot.winner_supplier}` : "") +
            (quot.total_winner ? ` • Total: ${fmtBRL(Number(quot.total_winner))}` : "")
          : "—",
      ],
      [
        "Contrato de gestão",
        contract?.name || "—",
        contract
          ? `Período: ${contract.period || "—"} • Valor global: ${fmtBRL(Number(contract.value || 0))}`
          : "—",
      ],
    ],
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 130, fontStyle: "bold", textColor: NAVY },
      1: { cellWidth: 130 },
      2: { cellWidth: "auto" as any },
    },
    rowPageBreak: "avoid",
    ...fixCharSpace,
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Fornecedor =====
  sectionTitle("Fornecedor");
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: baseTableStyles,
    headStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    head: [["Campo", "Valor"]],
    body: [
      ["Razão social", order.fornecedor_nome || "—"],
      ["CNPJ", order.fornecedor_cnpj || "—"],
      ["Endereço de entrega", order.endereco_entrega || "—"],
      ["CNPJ para emissão da NF", order.cnpj_emissao_nf || "—"],
      ["Prazo de entrega", order.prazo_entrega || "—"],
    ],
    margin: { left: margin, right: margin },
    columnStyles: { 0: { cellWidth: 180, fontStyle: "bold", textColor: NAVY } },
    rowPageBreak: "avoid",
    ...fixCharSpace,
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Itens =====
  sectionTitle("Itens da ordem de compra");
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { ...baseTableStyles, fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", halign: "center" },
    alternateRowStyles: { fillColor: ALT_ROW },
    head: [["#", "Descrição", "Qtd", "Un.", "Valor unit.", "Valor total"]],
    body: items.map((it: any) => [
      String(it.item_num ?? ""),
      it.descricao || "—",
      String(it.quantidade ?? ""),
      it.unidade_medida || "—",
      fmtBRL(Number(it.valor_unitario || 0)),
      fmtBRL(Number(it.valor_total || 0)),
    ]),
    foot: [[
      "", "", String(totalItens), "", "TOTAL", fmtBRL(Number(order.valor_total || 0))
    ]],
    footStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold", halign: "right" },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 30, halign: "right" },
      1: { cellWidth: "auto" as any },
      2: { cellWidth: 50, halign: "right" },
      3: { cellWidth: 50, halign: "center" },
      4: { cellWidth: 80, halign: "right" },
      5: { cellWidth: 90, halign: "right", fontStyle: "bold" },
    },
    rowPageBreak: "auto",
    ...fixCharSpace,
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Texto obrigatório NF =====
  if (order.texto_obrigatorio_nf && String(order.texto_obrigatorio_nf).trim()) {
    sectionTitle("Texto obrigatório na NF");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    (doc as any).setCharSpace(0);
    y += 6; // respiração entre título e caixa
    const lines = doc.splitTextToSize(String(order.texto_obrigatorio_nf), pageW - margin * 2 - 16);
    const boxH = lines.length * 12 + 16;
    y = ensureSpace(boxH + 8, y);
    doc.setFillColor(...ALT_ROW);
    doc.setDrawColor(...BORDER_BLUE);
    doc.roundedRect(margin, y, pageW - margin * 2, boxH, 3, 3, "FD");
    doc.setTextColor(...TEXT_DARK);
    doc.text(lines, margin + 8, y + 14);
    y += boxH + 20;
  }

  // ===== Aprovação / autorização =====
  sectionTitle("Aprovação");
  const approvalRows: [string, string][] = [
    ["Responsável pela emissão", order.responsavel_emissao_nome || "—"],
    ["Cargo", order.cargo || "—"],
    ["Aprovado em", order.aprovado_em ? fmtDateTime(order.aprovado_em) : "—"],
    ["Aprovador (assinatura digital)", lastApproval?.approver_name || "—"],
    ["Cargo do aprovador", lastApproval?.approver_cargo || "—"],
    ["E-mail do aprovador", lastApproval?.approver_email || "—"],
    ["Decisão", lastApproval?.decision === "aprovado" ? "Aprovado" : lastApproval?.decision === "negado" ? "Negado" : (lastApproval?.decision || "—")],
    ["Assinado em", lastApproval?.signed_at ? fmtDateTime(lastApproval.signed_at) : "—"],
    ["IP do aprovador", lastApproval?.approver_ip || "—"],
    ["Ciência LGPD", lastApproval?.ciencia_lgpd ? "Sim" : "—"],
    ["Token da assinatura", lastApproval?.token ? String(lastApproval.token).slice(0, 12) + "…" : "—"],
    ["Validade do link", lastApproval?.expires_at ? fmtDateTime(lastApproval.expires_at) : "—"],
  ];
  if (order.motivo_negacao) approvalRows.push(["Motivo da negação", order.motivo_negacao]);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: baseTableStyles,
    headStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    head: [["Campo", "Conteúdo"]],
    body: approvalRows,
    margin: { left: margin, right: margin },
    columnStyles: { 0: { cellWidth: 200, fontStyle: "bold", textColor: NAVY } },
    rowPageBreak: "avoid",
    ...fixCharSpace,
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Linha do tempo =====
  sectionTitle("Linha do tempo");
  const timelineRows: [string, string, string][] = [];
  timelineRows.push(["Criação da OC", fmtDateTime(order.created_at), "Sistema"]);
  if (order.data_envio_setor) timelineRows.push(["Envio ao setor", fmtDate(order.data_envio_setor), order.responsavel_emissao_nome || "—"]);
  if (order.aprovado_em) timelineRows.push(["Aprovação", fmtDateTime(order.aprovado_em), lastApproval?.approver_name || order.aprovado_por || "—"]);
  if (order.data_envio_fornecedor) timelineRows.push(["Envio ao fornecedor", fmtDate(order.data_envio_fornecedor), order.fornecedor_nome || "—"]);
  if (order.updated_at) timelineRows.push(["Última atualização", fmtDateTime(order.updated_at), "—"]);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: baseTableStyles,
    headStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    head: [["Evento", "Data / Hora", "Responsável"]],
    body: timelineRows,
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 180, fontStyle: "bold", textColor: NAVY },
      1: { cellWidth: 140 },
      2: { cellWidth: "auto" as any },
    },
    rowPageBreak: "avoid",
    ...fixCharSpace,
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Observações =====
  if (order.observacoes && String(order.observacoes).trim()) {
    sectionTitle("Observações");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    (doc as any).setCharSpace(0);
    y += 6; // respiração entre título e caixa
    const lines = doc.splitTextToSize(String(order.observacoes), pageW - margin * 2 - 16);
    const boxH = lines.length * 12 + 16;
    y = ensureSpace(boxH + 8, y);
    doc.setFillColor(...ALT_ROW);
    doc.setDrawColor(...BORDER_BLUE);
    doc.roundedRect(margin, y, pageW - margin * 2, boxH, 3, 3, "FD");
    doc.setTextColor(...TEXT_DARK);
    doc.text(lines, margin + 8, y + 14);
    y += boxH + 20;
  }

  // ===== Rodapé =====
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BORDER_BLUE);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 36, pageW - margin, pageH - 36);
    (doc as any).setCharSpace(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`OC ${order.numero || ""} • ${order.facility_unit || ""}`, margin, pageH - 22);
    doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 22, { align: "right" });
  }

  if (options?.returnBlob) {
    return doc.output("blob") as Blob;
  }
  doc.save(`ordem-compra-${order.numero || orderId}.pdf`);
}