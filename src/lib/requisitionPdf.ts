import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import {
  NAVY, BLUE, SOFT_BLUE, ALT_ROW, BORDER_BLUE, TEXT_DARK, TEXT_MUTED,
  fmtDate, fmtDateTime, fmtBRL,
  drawHeaderBand, drawSectionTitle, drawFooter, drawKpiRow, drawSoftTextBox,
  baseTableStyles,
} from "./purchasePdfTheme";

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

/**
 * Extrai o bloco JSON de justificativa legal embutido nas observações
 * via marcador `[JUST_LEGAL]...[/JUST_LEGAL]`. Devolve também o texto
 * limpo (sem o marcador) para uso em "Observações".
 */
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

export async function generateRequisitionPdf(
  requisitionId: string,
  options?: { returnBlob?: boolean }
): Promise<Blob | void> {
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
  (doc as any).setCharSpace(0);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  /** Configuração de cabeçalho — recalculada nas chamadas para refletir página atual. */
  const headerConfig = (full: boolean) => ({
    title: "REQUISIÇÃO DE COMPRA",
    leftLines: [
      `Nº ${req.numero || "—"}`,
      req.facility_unit || "—",
    ],
    rightLines: [
      `Emitido em ${fmtDateTime(new Date().toISOString())}`,
      `Status: ${REQ_STATUS_LABEL[req.status] || req.status || "—"}`,
    ],
    titleFontFull: 16,
    titleFontShort: 12,
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
    { label: "Itens", value: String(linhasItens) },
    { label: "Qtd. total", value: String(totalItens) },
    { label: "Cotações", value: String(quotations.length) },
    { label: "Convites", value: String(invites.length) },
    { label: "Ordens de compra", value: String(orders.length) },
  ], { valueFontSize: 15 });

  // ===== Dados gerais (duas colunas) =====
  y = ensureSpace(28, y);
  y = drawSectionTitle(doc, margin, y, "Dados gerais");

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
    styles: baseTableStyles,
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
    styles: baseTableStyles,
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
  y = ensureSpace(28, y);
  y = drawSectionTitle(doc, margin, y, "Itens solicitados");
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: baseTableStyles,
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
    y = ensureSpace(28, y);
    y = drawSectionTitle(doc, margin, y, `Justificativa legal — ${tipoLabel}`);

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
      styles: baseTableStyles,
      headStyles: { fillColor: SOFT_BLUE, textColor: NAVY, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW },
      head: [["Campo", "Conteúdo"]],
      body: legalRows,
      margin: { left: margin, right: margin },
      columnStyles: { 0: { cellWidth: 200, fontStyle: "bold", textColor: NAVY } },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // ===== Evidências anexadas (Inexigibilidade ou Dispensa) =====
    const anexosLegais: Array<{ name: string; path: string }> | null =
      justTipo === "inexigibilidade" && Array.isArray(legal?.fornecedor_unico_anexos) && legal.fornecedor_unico_anexos.length > 0
        ? legal.fornecedor_unico_anexos
        : justTipo === "dispensa" && Array.isArray(legal?.dispensa_anexos) && legal.dispensa_anexos.length > 0
        ? legal.dispensa_anexos
        : null;
    if (anexosLegais) {
      // Pré-resolve URLs assinadas (válidas por 7 dias) para todos os anexos.
      const signed: Array<{ name: string; url: string | null }> = [];
      for (const a of anexosLegais) {
        try {
          const { data } = await supabase.storage
            .from("purchase-attachments")
            .createSignedUrl(a.path, 60 * 60 * 24 * 7);
          signed.push({ name: a.name || a.path, url: data?.signedUrl || null });
        } catch {
          signed.push({ name: a.name || a.path, url: null });
        }
      }

      y = ensureSpace(28, y);
      y = drawSectionTitle(
        doc, margin, y,
        justTipo === "dispensa"
          ? "Evidências da fundamentação técnica e pesquisa de preços (anexos)"
          : "Evidências de exclusividade do fornecedor (anexos)"
      );
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
          doc.setTextColor(...BLUE);
          (doc as any).textWithLink(item.name, margin + prefixW, y, { url: item.url });
          const textW = doc.getTextWidth(item.name);
          doc.setDrawColor(...BLUE);
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

  // ===== Cotações vinculadas =====
  if (quotations.length) {
    y = ensureSpace(28, y);
    y = drawSectionTitle(doc, margin, y, "Cotações vinculadas");
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { ...baseTableStyles, fontSize: 8.5, cellPadding: 4 },
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
    y = ensureSpace(28, y);
    y = drawSectionTitle(doc, margin, y, "Ordens de compra geradas");
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { ...baseTableStyles, fontSize: 8.5, cellPadding: 4 },
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
    y = ensureSpace(28, y);
    y = drawSectionTitle(doc, margin, y, "Observações");
    y = ensureSpace(60, y);
    y = drawSoftTextBox(doc, margin, y, cleanObs);
  }

  // ===== Assinaturas (rodapé técnico, antes do paginador) =====
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

  // ===== Rodapé padrão =====
  drawFooter(doc, margin, `Requisição ${req.numero || ""} • ${req.facility_unit || ""}`);

  if (options?.returnBlob) {
    return doc.output("blob") as Blob;
  }
  doc.save(`requisicao-${req.numero || requisitionId}.pdf`);
}
