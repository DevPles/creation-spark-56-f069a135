import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import {
  NAVY, BLUE, SOFT_BLUE, ALT_ROW, BORDER_BLUE, TEXT_DARK, TEXT_MUTED, WIN_BG,
  fmtDate, fmtDateTime, fmtBRL,
  drawHeaderBand, drawSectionTitle, drawFooter, drawKpiRow, drawSoftTextBox,
  baseTableStyles,
} from "./purchasePdfTheme";

const QUOT_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export async function generateQuotationPdf(
  quotationId: string,
  options?: { returnBlob?: boolean }
): Promise<Blob | void> {
  const { data: quot, error: qErr } = await (supabase as any)
    .from("purchase_quotations")
    .select("*")
    .eq("id", quotationId)
    .maybeSingle();
  if (qErr || !quot) throw new Error("Cotação não encontrada");

  const [reqRes, itemsRes, suppliersRes, pricesRes, invitesRes] = await Promise.all([
    quot.requisition_id
      ? supabase.from("purchase_requisitions").select("*").eq("id", quot.requisition_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    quot.requisition_id
      ? supabase
          .from("purchase_requisition_items")
          .select("*")
          .eq("requisition_id", quot.requisition_id)
          .order("item_num", { ascending: true })
      : Promise.resolve({ data: [] } as any),
    (supabase as any)
      .from("purchase_quotation_suppliers")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("slot", { ascending: true }),
    (supabase as any)
      .from("purchase_quotation_prices")
      .select("*")
      .eq("quotation_id", quotationId),
    quot.requisition_id
      ? (supabase as any)
          .from("quotation_invites")
          .select("*")
          .eq("requisition_id", quot.requisition_id)
      : Promise.resolve({ data: [] } as any),
  ]);

  const req = (reqRes as any).data || null;
  const items = (itemsRes as any).data || [];
  const suppliers = (suppliersRes as any).data || [];
  const prices = (pricesRes as any).data || [];
  const invites = (invitesRes as any).data || [];

  const priceFor = (itemId: string, supplierRowId: string) =>
    prices.find((p: any) => p.requisition_item_id === itemId && p.supplier_id === supplierRowId);

  const totalsBySupplier: Record<string, number> = {};
  suppliers.forEach((s: any) => {
    totalsBySupplier[s.id] = prices
      .filter((p: any) => p.supplier_id === s.id)
      .reduce((acc: number, p: any) => acc + Number(p.valor_total || 0), 0);
  });
  /** Vencedor = menor total > 0 entre fornecedores cotados. */
  const winnerSupplierId = (() => {
    const withPrices = suppliers
      .map((s: any) => ({ id: s.id, total: totalsBySupplier[s.id] || 0 }))
      .filter((s) => s.total > 0);
    if (!withPrices.length) return null;
    withPrices.sort((a, b) => a.total - b.total);
    return withPrices[0].id;
  })();

  const totalRespostas = invites.filter((i: any) => i.submitted_at).length;

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  (doc as any).setCharSpace(0);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  const headerConfig = (full: boolean) => ({
    title: "MAPA DE COTACAO",
    leftLines: [
      `No. ${quot.numero || "-"}`,
      quot.facility_unit || "-",
    ],
    rightLines: [
      `Emitido em ${fmtDateTime(new Date().toISOString())}`,
      `Status: ${QUOT_STATUS_LABEL[quot.status] || quot.status || "-"}`,
    ],
    logoHeightFull: 60,
    logoHeightShort: 44,
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
  y = drawKpiRow(doc, margin, y, [
    { label: "Itens cotados", value: String(items.length) },
    { label: "Fornecedores", value: String(suppliers.length) },
    { label: "Convites enviados", value: String(invites.length) },
    { label: "Respostas recebidas", value: String(totalRespostas) },
    { label: "Total vencedor", value: fmtBRL(Number(quot.total_winner || (winnerSupplierId ? totalsBySupplier[winnerSupplierId] : 0))) },
  ]);

  // ===== Dados gerais =====
  y = ensureSpace(28, y);
  y = drawSectionTitle(doc, margin, y, "Dados gerais");
  const leftRows: [string, string][] = [
    ["Nº da Cotação", quot.numero || "—"],
    ["Data da Cotação", fmtDate(quot.data_cotacao)],
    ["Unidade", quot.facility_unit || "—"],
    ["Setor comprador", quot.setor_comprador || "—"],
  ];
  const rightRows: [string, string][] = [
    ["Requisição vinculada", req?.numero || "—"],
    ["Data da requisição", fmtDate(req?.data_requisicao)],
    ["Setor solicitante", req?.setor || "—"],
    ["Solicitante", req?.solicitante_nome || "—"],
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
    columnStyles: { 0: { cellWidth: 130, fontStyle: "bold", textColor: NAVY } },
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
    columnStyles: { 0: { cellWidth: 130, fontStyle: "bold", textColor: NAVY } },
  });
  const rightEnd = (doc as any).lastAutoTable.finalY;
  y = Math.max(leftEnd, rightEnd) + 16;

  // ===== Fornecedores participantes =====
  if (suppliers.length) {
    y = ensureSpace(28, y);
    y = drawSectionTitle(doc, margin, y, "Fornecedores participantes");
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { ...baseTableStyles, fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW },
      head: [["Slot", "Fornecedor", "CNPJ", "Pagamento", "Prazo entrega", "Origem", "Total"]],
      body: suppliers.map((s: any) => [
        s.slot || "—",
        s.fornecedor_nome || "—",
        s.fornecedor_cnpj || "—",
        s.condicao_pagamento || "—",
        s.prazo_entrega || "—",
        s.fonte === "invite_link" ? "Link público" : (s.fonte || "manual"),
        fmtBRL(Number(totalsBySupplier[s.id] || s.total || 0)),
      ]),
      margin: { left: margin, right: margin },
      columnStyles: { 6: { halign: "right", fontStyle: "bold" } },
      didParseCell: (data: any) => {
        const row = suppliers[data.row.index];
        if (row && row.id === winnerSupplierId) {
          data.cell.styles.fillColor = WIN_BG;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // ===== Mapa comparativo (item × fornecedor) =====
  if (items.length && suppliers.length) {
    y = ensureSpace(28, y);
    y = drawSectionTitle(doc, margin, y, "Mapa comparativo de preços");
    const head = [
      "#",
      "Descrição",
      "Qtd",
      "Un.",
      ...suppliers.map((s: any) => s.fornecedor_nome || "Forn."),
    ];
    const body = items.map((it: any) => {
      const cells: any[] = [
        String(it.item_num ?? ""),
        it.descricao || "—",
        String(it.quantidade ?? ""),
        it.unidade_medida || "—",
      ];
      suppliers.forEach((s: any) => {
        const p = priceFor(it.id, s.id);
        if (!p) {
          cells.push("—");
        } else if (Number(p.valor_unitario || 0) === 0) {
          cells.push("Não cot.");
        } else {
          cells.push(fmtBRL(Number(p.valor_unitario)));
        }
      });
      return cells;
    });
    // Linha de totais por fornecedor
    const totalsRow: any[] = ["", "TOTAL POR FORNECEDOR", "", ""];
    suppliers.forEach((s: any) => {
      totalsRow.push(fmtBRL(Number(totalsBySupplier[s.id] || 0)));
    });
    body.push(totalsRow);

    const supplierCount = suppliers.length;
    const fixedCols = 4;
    const fixedW = 28 + 200 + 40 + 36;
    const remaining = pageW - margin * 2 - fixedW;
    const supplierW = Math.max(70, remaining / Math.max(1, supplierCount));

    const colStyles: any = {
      0: { cellWidth: 28, halign: "right" },
      1: { cellWidth: 200 },
      2: { cellWidth: 40, halign: "right" },
      3: { cellWidth: 36, halign: "center" },
    };
    suppliers.forEach((_s: any, idx: number) => {
      colStyles[fixedCols + idx] = { cellWidth: supplierW, halign: "right" };
    });

    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { ...baseTableStyles, fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: ALT_ROW },
      head: [head],
      body,
      margin: { left: margin, right: margin },
      columnStyles: colStyles,
      didParseCell: (data: any) => {
        // Última linha = totais
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = SOFT_BLUE;
          data.cell.styles.textColor = NAVY;
        }
        // Coluna do fornecedor vencedor
        const colIdx = data.column.index;
        if (colIdx >= fixedCols) {
          const sup = suppliers[colIdx - fixedCols];
          if (sup && sup.id === winnerSupplierId) {
            data.cell.styles.fillColor = WIN_BG;
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // ===== Convites =====
  if (invites.length) {
    y = ensureSpace(28, y);
    y = drawSectionTitle(doc, margin, y, "Convites a fornecedores");
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { ...baseTableStyles, fontSize: 8.5, cellPadding: 4 },
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

  // ===== Resultado / vencedor =====
  y = ensureSpace(28, y);
  y = drawSectionTitle(doc, margin, y, "Resultado da cotação");
  const winnerRow = suppliers.find((s: any) => s.id === winnerSupplierId);
  const resultRows: [string, string][] = [
    ["Fornecedor vencedor", quot.winner_supplier || winnerRow?.fornecedor_nome || "—"],
    ["CNPJ", winnerRow?.fornecedor_cnpj || "—"],
    ["Condição de pagamento", winnerRow?.condicao_pagamento || "—"],
    ["Prazo de entrega", winnerRow?.prazo_entrega || "—"],
    ["Total vencedor", fmtBRL(Number(quot.total_winner || (winnerSupplierId ? totalsBySupplier[winnerSupplierId] : 0)))],
  ];
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: baseTableStyles,
    headStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    head: [["Campo", "Conteúdo"]],
    body: resultRows,
    margin: { left: margin, right: margin },
    columnStyles: { 0: { cellWidth: 200, fontStyle: "bold", textColor: NAVY } },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Observações =====
  if (quot.observacoes && String(quot.observacoes).trim()) {
    y = ensureSpace(28, y);
    y = drawSectionTitle(doc, margin, y, "Observações");
    y = ensureSpace(60, y);
    y = drawSoftTextBox(doc, margin, y, String(quot.observacoes));
  }

  // ===== Rodapé padrão =====
  drawFooter(doc, margin, `Cotação ${quot.numero || ""} • ${quot.facility_unit || ""}`);

  if (options?.returnBlob) {
    return doc.output("blob") as Blob;
  }
  doc.save(`mapa-cotacao-${quot.numero || quotationId}.pdf`);
}
