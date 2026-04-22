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

const QUOT_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

// Paleta azul corporativa (igual à requisição)
const NAVY: [number, number, number] = [11, 47, 99];
const BLUE: [number, number, number] = [29, 78, 156];
const SOFT_BLUE: [number, number, number] = [219, 232, 248];
const ALT_ROW: [number, number, number] = [243, 247, 252];
const BORDER_BLUE: [number, number, number] = [180, 202, 230];
const TEXT_DARK: [number, number, number] = [20, 32, 56];
const TEXT_MUTED: [number, number, number] = [90, 105, 130];
const WIN_BG: [number, number, number] = [220, 245, 224]; // verde suave para vencedor

export async function generateQuotationPdf(quotationId: string) {
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

  // Helpers de busca
  const priceFor = (itemId: string, supplierRowId: string) =>
    prices.find((p: any) => p.requisition_item_id === itemId && p.supplier_id === supplierRowId);

  const totalsBySupplier: Record<string, number> = {};
  suppliers.forEach((s: any) => {
    totalsBySupplier[s.id] = prices
      .filter((p: any) => p.supplier_id === s.id)
      .reduce((acc: number, p: any) => acc + Number(p.valor_total || 0), 0);
  });
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
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  const ensureSpace = (needed: number, currentY: number) => {
    if (currentY + needed > pageH - 60) {
      doc.addPage();
      drawHeaderBand(false);
      return 100;
    }
    return currentY;
  };

  const drawHeaderBand = (full: boolean) => {
    const bandH = full ? 96 : 64;
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, bandH, "F");
    doc.setFillColor(...BLUE);
    doc.rect(0, bandH, pageW, 4, "F");

    try {
      const logoH = full ? 60 : 44;
      const logoW = logoH * 1.6;
      const logoX = pageW - margin - logoW;
      const logoY = (bandH - logoH) / 2;
      doc.addImage(UNIVIDA_LOGO_BASE64, "PNG", logoX, logoY, logoW, logoH, undefined, "FAST");
    } catch {/* ignore */}

    doc.setTextColor(255, 255, 255);
    (doc as any).setCharSpace(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(full ? 18 : 13);
    doc.text("MAPA DE COTACAO", margin, full ? 32 : 24);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(full ? 10 : 9);
    doc.text(`No. ${quot.numero || "-"}`, margin, full ? 52 : 42);
    if (full) {
      doc.text(quot.facility_unit || "-", margin, 70);
    }
    if (full) {
      doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageW - margin, 52, { align: "right" });
      doc.text(`Status: ${QUOT_STATUS_LABEL[quot.status] || quot.status || "-"}`, pageW - margin, 70, { align: "right" });
    } else {
      doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageW - margin, 42, { align: "right" });
    }
    doc.setTextColor(...TEXT_DARK);
  };

  drawHeaderBand(true);
  let y = 120;

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

  // ===== KPIs =====
  const kpis = [
    { label: "Itens cotados", value: String(items.length) },
    { label: "Fornecedores", value: String(suppliers.length) },
    { label: "Convites enviados", value: String(invites.length) },
    { label: "Respostas recebidas", value: String(totalRespostas) },
    { label: "Total vencedor", value: fmtBRL(Number(quot.total_winner || (winnerSupplierId ? totalsBySupplier[winnerSupplierId] : 0))) },
  ];
  const kpiW = (pageW - margin * 2 - 8 * (kpis.length - 1)) / kpis.length;
  const kpiH = 46;
  kpis.forEach((k, i) => {
    const x = margin + i * (kpiW + 8);
    doc.setFillColor(...SOFT_BLUE);
    doc.setDrawColor(...BORDER_BLUE);
    doc.roundedRect(x, y, kpiW, kpiH, 4, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(k.value, x + kpiW / 2, y + 22, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(k.label, x + kpiW / 2, y + 36, { align: "center" });
  });
  y += kpiH + 18;
  doc.setTextColor(...TEXT_DARK);

  // ===== Dados gerais =====
  sectionTitle("Dados gerais");
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
    styles: { fontSize: 9, cellPadding: 5, lineColor: BORDER_BLUE, textColor: TEXT_DARK },
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
    styles: { fontSize: 9, cellPadding: 5, lineColor: BORDER_BLUE, textColor: TEXT_DARK },
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
    sectionTitle("Fornecedores participantes");
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: BORDER_BLUE, textColor: TEXT_DARK },
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW },
      head: [["Slot", "Fornecedor", "CNPJ", "Pagamento", "Prazo entrega", "Origem", "Total"]],
      body: suppliers.map((s: any) => {
        const isWin = s.id === winnerSupplierId;
        return [
          s.slot || "—",
          (isWin ? "★ " : "") + (s.fornecedor_nome || "—"),
          s.fornecedor_cnpj || "—",
          s.condicao_pagamento || "—",
          s.prazo_entrega || "—",
          s.fonte === "invite_link" ? "Link público" : (s.fonte || "manual"),
          fmtBRL(Number(totalsBySupplier[s.id] || s.total || 0)),
        ];
      }),
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
    sectionTitle("Mapa comparativo de preços");
    const head = [
      "#",
      "Descrição",
      "Qtd",
      "Un.",
      ...suppliers.map((s: any) => `${s.fornecedor_nome || "Forn."}${s.id === winnerSupplierId ? " ★" : ""}`),
    ];
    const body = items.map((it: any) => {
      const cells: any[] = [
        String(it.item_num ?? ""),
        it.descricao || "—",
        String(it.quantidade ?? ""),
        it.unidade_medida || "—",
      ];
      // Determinar menor preço unitário disponível para este item
      const itemPrices = suppliers
        .map((s: any) => priceFor(it.id, s.id))
        .filter((p: any) => p && Number(p.valor_unitario || 0) > 0)
        .map((p: any) => Number(p.valor_unitario || 0));
      const minUnit = itemPrices.length ? Math.min(...itemPrices) : null;
      suppliers.forEach((s: any) => {
        const p = priceFor(it.id, s.id);
        if (!p) {
          cells.push("—");
        } else if (Number(p.valor_unitario || 0) === 0) {
          cells.push("Não cot.");
        } else {
          const isMin = minUnit !== null && Number(p.valor_unitario) === minUnit;
          cells.push(`${fmtBRL(Number(p.valor_unitario))}${isMin ? " ✓" : ""}`);
        }
      });
      return cells;
    });
    // Linha de totais
    const totalsRow: any[] = ["", "TOTAL POR FORNECEDOR", "", ""];
    suppliers.forEach((s: any) => {
      totalsRow.push(fmtBRL(Number(totalsBySupplier[s.id] || 0)));
    });
    body.push(totalsRow);

    const supplierCount = suppliers.length;
    const fixedCols = 4;
    const fixedW = 28 + 200 + 40 + 36; // # / desc / qtd / un
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
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: BORDER_BLUE, textColor: TEXT_DARK, overflow: "linebreak" },
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

  // ===== Resultado / vencedor =====
  sectionTitle("Resultado da cotação");
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
    styles: { fontSize: 9, cellPadding: 5, lineColor: BORDER_BLUE, textColor: TEXT_DARK },
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
    sectionTitle("Observações");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(String(quot.observacoes), pageW - margin * 2);
    y = ensureSpace(lines.length * 12 + 14, y);
    doc.setFillColor(...ALT_ROW);
    doc.setDrawColor(...BORDER_BLUE);
    doc.roundedRect(margin, y - 4, pageW - margin * 2, lines.length * 12 + 14, 3, 3, "FD");
    doc.text(lines, margin + 8, y + 8);
    y += lines.length * 12 + 18;
  }

  // ===== Rodapé =====
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BORDER_BLUE);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 36, pageW - margin, pageH - 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Cotação ${quot.numero || ""} • ${quot.facility_unit || ""}`, margin, pageH - 22);
    doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 22, { align: "right" });
  }

  doc.save(`mapa-cotacao-${quot.numero || quotationId}.pdf`);
}