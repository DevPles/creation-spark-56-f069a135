import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { UNIVIDA_LOGO_BASE64 } from "@/assets/univida-logo-base64";

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

const JUSTIFICATIVA_LABEL: Record<string, string> = {
  mensal: "Reposição mensal",
  reposicao: "Reposição de estoque",
  emergencial: "Compra emergencial",
  dispensa: "Dispensa de licitação",
  inexigibilidade: "Inexigibilidade de licitação",
  projeto: "Projeto / investimento",
};

const parseLegalBlock = (obs?: string | null): { legal: any; clean: string } => {
  const raw = obs || "";
  const match = raw.match(/\[JUST_LEGAL\]([\s\S]*?)\[\/JUST_LEGAL\]/);
  let legal: any = null;
  if (match) {
    try { legal = JSON.parse(match[1]); } catch { legal = null; }
  }
  const clean = raw.replace(/\[JUST_LEGAL\][\s\S]*?\[\/JUST_LEGAL\]/, "").trim();
  return { legal, clean };
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

  const { legal, clean: cleanObs } = parseLegalBlock(req.observacoes);
  const justTipo = (req.justificativa_tipo || "").toLowerCase();
  const isLegalSpecial = ["dispensa", "inexigibilidade", "emergencial"].includes(justTipo);

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

    // Logo Univida (canto direito da faixa)
    try {
      const logoH = full ? 56 : 40;
      const logoW = logoH * 1.6;
      const logoX = pageW - margin - logoW;
      const logoY = full ? (88 - logoH) / 2 : (60 - logoH) / 2;
      doc.addImage(UNIVIDA_LOGO_BASE64, "PNG", logoX, logoY, logoW, logoH, undefined, "FAST");
    } catch {
      // ignore image errors
    }

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
    // Texto à direita posicionado abaixo do logo
    const rightTextY = full ? 78 : 52;
    doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageW - margin, rightTextY, { align: "right" });
    if (full) {
      doc.text(`Status: ${REQ_STATUS_LABEL[req.status] || req.status || "—"}`, pageW - margin, rightTextY + 12, { align: "right" });
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
    ["Justificativa / tipo", JUSTIFICATIVA_LABEL[justTipo] || req.justificativa_tipo || "—"],
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
    body: (items || []).map((it: any) => {
      const rawObs: string = it.observacao || "";
      const cleanObs = rawObs.replace(/^\[COD:[^\]]+\]\s?/, "").trim();
      return [
        String(it.item_num ?? ""),
        it.descricao || "—",
        String(it.quantidade ?? ""),
        it.unidade_medida || "—",
        cleanObs,
      ];
    }),
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 30, halign: "right" },
      2: { cellWidth: 50, halign: "right" },
      3: { cellWidth: 60, halign: "center" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // ===== Justificativa legal (Dispensa / Inexigibilidade / Emergencial) =====
  if (isLegalSpecial) {
    const tipoLabel =
      justTipo === "dispensa" ? "Dispensa de Licitação"
      : justTipo === "inexigibilidade" ? "Inexigibilidade de Licitação"
      : "Compra Emergencial";
    sectionTitle(`Justificativa legal — ${tipoLabel}`);
    const legalRows: [string, string][] = [
      ["Base legal / artigo", legal?.base_legal || "—"],
      ["Justificativa da escolha", legal?.justificativa || "—"],
      ["Fundamentação técnica", legal?.fundamentacao || "—"],
    ];
    if (justTipo === "inexigibilidade") {
      legalRows.push(["Comprovação de exclusividade / fornecedor único", legal?.fornecedor_unico || "—"]);
    }
    if (justTipo === "dispensa") {
      legalRows.push(["Comparativo / pesquisa de preços", legal?.fornecedor_unico || "—"]);
    }
    if (justTipo === "emergencial") {
      legalRows.push(["Descrição do risco / dano potencial", legal?.risco_descricao || "—"]);
      legalRows.push(["Prazo máximo (urgência)", legal?.urgencia_prazo || "—"]);
    }
    if (legal?.responsavel_tecnico) {
      legalRows.push(["Responsável técnico", legal.responsavel_tecnico]);
    }
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5, lineColor: BORDER_BLUE, textColor: TEXT_DARK },
      headStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW },
      head: [["Campo", "Conteúdo"]],
      body: legalRows,
      margin: { left: margin, right: margin },
      columnStyles: { 0: { cellWidth: 200, fontStyle: "bold", textColor: NAVY } },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // ===== Evidências anexadas (Inexigibilidade — comprovação de exclusividade) =====
    if (justTipo === "inexigibilidade" && Array.isArray(legal?.fornecedor_unico_anexos) && legal.fornecedor_unico_anexos.length > 0) {
      // Gera links assinados (7 dias) para cada anexo
      const anexos: Array<{ name: string; path: string }> = legal.fornecedor_unico_anexos;
      const signed: Array<{ name: string; url: string | null }> = [];
      for (const a of anexos) {
        try {
          const { data } = await supabase.storage
            .from("purchase-attachments")
            .createSignedUrl(a.path, 60 * 60 * 24 * 7);
          signed.push({ name: a.name || a.path, url: data?.signedUrl || null });
        } catch {
          signed.push({ name: a.name || a.path, url: null });
        }
      }

      sectionTitle("Evidências de exclusividade do fornecedor (anexos)");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(
        "Clique no nome do arquivo para baixar/visualizar. Links válidos por 7 dias a partir da emissão deste relatório.",
        margin, y
      );
      y += 14;

      for (let i = 0; i < signed.length; i++) {
        y = ensureSpace(18, y);
        const item = signed[i];
        const prefix = `${i + 1}. `;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...TEXT_DARK);
        doc.text(prefix, margin, y);
        const prefixW = doc.getTextWidth(prefix);
        if (item.url) {
          doc.setTextColor(29, 78, 156);
          (doc as any).textWithLink(item.name, margin + prefixW, y, { url: item.url });
          // Sublinhado simples
          const textW = doc.getTextWidth(item.name);
          doc.setDrawColor(29, 78, 156);
          doc.setLineWidth(0.4);
          doc.line(margin + prefixW, y + 1.5, margin + prefixW + textW, y + 1.5);
        } else {
          doc.setTextColor(...TEXT_MUTED);
          doc.text(`${item.name} (link indisponível)`, margin + prefixW, y);
        }
        y += 14;
      }
      doc.setTextColor(...TEXT_DARK);
      y += 6;
    }
  }

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
  if (cleanObs) {
    sectionTitle("Observações");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(cleanObs, pageW - margin * 2);
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