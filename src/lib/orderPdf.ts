import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import {
  NAVY, BLUE, SOFT_BLUE, ALT_ROW, BORDER_BLUE, TEXT_DARK, TEXT_MUTED,
  fmtDate, fmtDateTime, fmtBRL,
  drawHeaderBand, drawSectionTitle, drawFooter, drawKpiRow, drawSoftTextBox,
  baseTableStyles, fixCharSpaceHook,
} from "./purchasePdfTheme";

const OC_STATUS_LABEL: Record<string, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  autorizada: "Autorizada",
  negada: "Negada",
  enviada: "Enviada ao fornecedor",
  recebida: "Recebida",
  cancelada: "Cancelada",
};

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

  /** Header com requisição vinculada e Aprovado em (linha 3 da direita). */
  const headerConfig = (full: boolean) => ({
    title: "ORDEM DE COMPRA",
    leftLines: [
      `No. ${order.numero || "-"}`,
      ...(req?.numero ? [`Requisição: ${req.numero}`] : []),
      order.facility_unit || "-",
    ],
    rightLines: [
      `Emitido em ${fmtDateTime(new Date().toISOString())}`,
      `Status: ${OC_STATUS_LABEL[order.status] || order.status || "-"}`,
      ...(order.aprovado_em ? [`Aprovada em ${fmtDateTime(order.aprovado_em)}`] : []),
    ],
  });

  const ensureSpace = (needed: number, currentY: number) => {
    if (currentY + needed > pageH - 60) {
      doc.addPage();
      drawHeaderBand(doc, margin, false, headerConfig(false));
      return 96;
    }
    return currentY;
  };

  drawHeaderBand(doc, margin, true, headerConfig(true));
  let y = 138;

  // ===== KPIs =====
  const totalItens = items.reduce((acc: number, it: any) => acc + Number(it.quantidade || 0), 0);
  y = drawKpiRow(doc, margin, y, [
    { label: "Itens", value: String(items.length) },
    { label: "Quantidade total", value: String(totalItens) },
    { label: "Valor total", value: fmtBRL(Number(order.valor_total || 0)) },
    { label: "Status", value: OC_STATUS_LABEL[order.status] || order.status || "—" },
  ], { valueFontSize: 12 });

  // ===== Dados gerais =====
  y = ensureSpace(28, y);
  y = drawSectionTitle(doc, margin, y, "Dados gerais");
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
    ...fixCharSpaceHook,
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
    ...fixCharSpaceHook,
  });
  const rightEnd = (doc as any).lastAutoTable.finalY;
  y = Math.max(leftEnd, rightEnd) + 16;

  // ===== Vínculos (Requisição / Cotação / Contrato) =====
  y = ensureSpace(28, y);
  y = drawSectionTitle(doc, margin, y, "Vínculos");
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
    ...fixCharSpaceHook,
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Fornecedor =====
  y = ensureSpace(28, y);
  y = drawSectionTitle(doc, margin, y, "Fornecedor");
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
    ...fixCharSpaceHook,
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Itens =====
  y = ensureSpace(28, y);
  y = drawSectionTitle(doc, margin, y, "Itens da ordem de compra");
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { ...baseTableStyles, fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold", halign: "center" },
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
    ...fixCharSpaceHook,
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Texto obrigatório NF =====
  if (order.texto_obrigatorio_nf && String(order.texto_obrigatorio_nf).trim()) {
    y = ensureSpace(28, y);
    y = drawSectionTitle(doc, margin, y, "Texto obrigatório na NF");
    y = ensureSpace(60, y);
    y = drawSoftTextBox(doc, margin, y, String(order.texto_obrigatorio_nf), { fontSize: 9.5 });
  }

  // ===== Aprovação / autorização =====
  y = ensureSpace(28, y);
  y = drawSectionTitle(doc, margin, y, "Aprovação");
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
    ...fixCharSpaceHook,
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Linha do tempo =====
  y = ensureSpace(28, y);
  y = drawSectionTitle(doc, margin, y, "Linha do tempo");
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
    ...fixCharSpaceHook,
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Observações =====
  if (order.observacoes && String(order.observacoes).trim()) {
    y = ensureSpace(28, y);
    y = drawSectionTitle(doc, margin, y, "Observações");
    y = ensureSpace(60, y);
    y = drawSoftTextBox(doc, margin, y, String(order.observacoes));
  }

  // ===== Rodapé padrão =====
  drawFooter(doc, margin, `OC ${order.numero || ""} • ${order.facility_unit || ""}`);

  if (options?.returnBlob) {
    return doc.output("blob") as Blob;
  }
  doc.save(`ordem-compra-${order.numero || orderId}.pdf`);
}
