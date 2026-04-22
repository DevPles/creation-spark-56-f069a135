import jsPDF from "jspdf";
import type { Styles } from "jspdf-autotable";
import { format } from "date-fns";
import { UNIVIDA_LOGO_BASE64 } from "@/assets/univida-logo-base64";

/**
 * Tema visual compartilhado entre os PDFs do módulo de Compras
 * (Requisição, Cotação, Ordem de Compra e Dossiê).
 *
 * Mantém:
 *  - Paleta corporativa azul (sem verde) consistente entre documentos.
 *  - Cabeçalho com banda NAVY + faixa BLUE, logo Univida com zona segura
 *    para evitar sobreposição do texto da direita.
 *  - Helpers de seção, rodapé, KPIs e formatação.
 *
 * Cada gerador consome estes helpers para reduzir duplicação e garantir
 * paridade visual entre os documentos.
 */

// ============= Paleta =============
export const NAVY: [number, number, number] = [11, 47, 99];
export const BLUE: [number, number, number] = [29, 78, 156];
export const SOFT_BLUE: [number, number, number] = [219, 232, 248];
export const ALT_ROW: [number, number, number] = [243, 247, 252];
export const BORDER_BLUE: [number, number, number] = [180, 202, 230];
export const TEXT_DARK: [number, number, number] = [20, 32, 56];
export const TEXT_MUTED: [number, number, number] = [90, 105, 130];
/** Destaque para fornecedor vencedor — azul suave (sem verde por diretriz). */
export const WIN_BG: [number, number, number] = [219, 232, 248];

// ============= Formatadores =============
export const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return "—"; }
};

export const fmtDateTime = (d?: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy HH:mm"); } catch { return "—"; }
};

export const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

// ============= Header =============
export interface HeaderConfig {
  /** Título grande do documento ("ORDEM DE COMPRA", "MAPA DE COTACAO", etc.) */
  title: string;
  /** Linhas adicionais à esquerda (No., Unidade, Requisição vinculada, etc.). */
  leftLines: string[];
  /** Linhas adicionais à direita (Emitido em, Status, Aprovado em, etc.). */
  rightLines: string[];
  /** Altura do logo na banda completa. Default 56pt. */
  logoHeightFull?: number;
  /** Altura do logo na banda reduzida. Default 40pt. */
  logoHeightShort?: number;
  /** Tamanho da fonte do título (banda completa). Default 18pt. */
  titleFontFull?: number;
  /** Tamanho da fonte do título (banda reduzida). Default 13pt. */
  titleFontShort?: number;
}

/**
 * Desenha o cabeçalho institucional (Univida) com zona segura ao redor do logo
 * para impedir que textos à direita encostem na imagem.
 *
 * @param doc instância jsPDF
 * @param margin margem horizontal global do documento
 * @param full true = primeira página (banda alta); false = páginas seguintes
 * @param cfg textos e dimensões
 * @returns altura total da banda (útil para calcular `y` inicial)
 */
export function drawHeaderBand(
  doc: jsPDF,
  margin: number,
  full: boolean,
  cfg: HeaderConfig,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const bandH = full ? 110 : 70;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, bandH, "F");
  doc.setFillColor(...BLUE);
  doc.rect(0, bandH, pageW, 4, "F");

  // Logo com zona segura
  const logoH = full ? (cfg.logoHeightFull ?? 56) : (cfg.logoHeightShort ?? 40);
  const logoW = logoH * 1.6;
  const logoMargin = 16;
  const logoX = pageW - margin - logoW;
  const logoY = (bandH - logoH) / 2;
  try {
    doc.addImage(UNIVIDA_LOGO_BASE64, "PNG", logoX, logoY, logoW, logoH, undefined, "FAST");
  } catch {
    /* logo opcional */
  }
  const rightTextLimit = logoX - logoMargin;

  // Texto do cabeçalho
  doc.setTextColor(255, 255, 255);
  (doc as any).setCharSpace(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(full ? (cfg.titleFontFull ?? 18) : (cfg.titleFontShort ?? 13));
  doc.text(cfg.title, margin, full ? 32 : 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(full ? 10 : 9);

  // Coluna esquerda: 1ª linha sempre visível; demais só na banda completa.
  const leftStartY = full ? 52 : 42;
  const leftStep = 18;
  const leftLines = full ? cfg.leftLines : cfg.leftLines.slice(0, 1);
  leftLines.forEach((line, i) => {
    if (line) doc.text(line, margin, leftStartY + i * leftStep);
  });

  // Coluna direita: ancorada no rightTextLimit (fora do logo).
  const rightStartY = full ? 52 : 42;
  const rightStep = 18;
  const rightLines = full ? cfg.rightLines : cfg.rightLines.slice(0, 1);
  rightLines.forEach((line, i) => {
    if (line) doc.text(line, rightTextLimit, rightStartY + i * rightStep, { align: "right" });
  });

  doc.setTextColor(...TEXT_DARK);
  return bandH;
}

// ============= Section title =============
/**
 * Desenha um título de seção (faixa lateral azul + texto BLUE em maiúsculas).
 * Retorna o novo `y` após o título, com respiração apropriada para que o
 * conteúdo seguinte não encoste no título.
 *
 * @param spacingAfter respiração entre título e próximo bloco. Default 14pt.
 */
export function drawSectionTitle(
  doc: jsPDF,
  margin: number,
  y: number,
  title: string,
  spacingAfter = 14,
): number {
  (doc as any).setCharSpace(0);
  doc.setFillColor(...BLUE);
  doc.rect(margin, y - 12, 4, 16, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLUE);
  doc.text(title.toUpperCase(), margin + 10, y);
  doc.setTextColor(...TEXT_DARK);
  return y + spacingAfter;
}

// ============= Rodapé =============
/**
 * Desenha rodapé padrão (linha + texto à esquerda + paginação à direita)
 * em todas as páginas do documento.
 */
export function drawFooter(doc: jsPDF, margin: number, leftLabel: string): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
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
    doc.text(leftLabel, margin, pageH - 22);
    doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 22, { align: "right" });
  }
}

// ============= KPIs =============
export interface Kpi { label: string; value: string }

/**
 * Desenha uma faixa horizontal de KPIs em cartões (fundo SOFT_BLUE).
 * @returns o novo `y` após os cartões.
 */
export function drawKpiRow(
  doc: jsPDF,
  margin: number,
  y: number,
  kpis: Kpi[],
  opts?: { valueFontSize?: number; height?: number },
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const gap = 8;
  const kpiW = (pageW - margin * 2 - gap * (kpis.length - 1)) / kpis.length;
  const kpiH = opts?.height ?? 46;
  const valueFont = opts?.valueFontSize ?? 13;
  kpis.forEach((k, i) => {
    const x = margin + i * (kpiW + gap);
    doc.setFillColor(...SOFT_BLUE);
    doc.setDrawColor(...BORDER_BLUE);
    doc.roundedRect(x, y, kpiW, kpiH, 4, 4, "FD");
    (doc as any).setCharSpace(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(valueFont);
    doc.setTextColor(...NAVY);
    const lines = doc.splitTextToSize(k.value, kpiW - 12);
    doc.text(lines[0] || "—", x + kpiW / 2, y + 22, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(k.label, x + kpiW / 2, y + 36, { align: "center" });
  });
  doc.setTextColor(...TEXT_DARK);
  return y + kpiH + 18;
}

// ============= Caixa de texto destacada =============
/**
 * Desenha uma caixa SOFT_BLUE / ALT_ROW com texto multi-linha. Usada para
 * "Texto obrigatório na NF" e "Observações". Garante respiração entre o
 * título da seção e o conteúdo (evita sobreposição).
 */
export function drawSoftTextBox(
  doc: jsPDF,
  margin: number,
  y: number,
  text: string,
  opts?: { fontSize?: number },
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const fontSize = opts?.fontSize ?? 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  (doc as any).setCharSpace(0);
  const lines = doc.splitTextToSize(text, pageW - margin * 2 - 16);
  const boxH = lines.length * 12 + 16;
  doc.setFillColor(...ALT_ROW);
  doc.setDrawColor(...BORDER_BLUE);
  doc.roundedRect(margin, y, pageW - margin * 2, boxH, 3, 3, "FD");
  doc.setTextColor(...TEXT_DARK);
  doc.text(lines, margin + 8, y + 14);
  return y + boxH + 20;
}

// ============= autoTable defaults =============
/**
 * Estilos base reutilizáveis para `jspdf-autotable`. Combine com
 * `headStyles` específicos por seção.
 */
export const baseTableStyles: Partial<Styles> = {
  font: "helvetica",
  fontSize: 9,
  cellPadding: 5,
  lineColor: BORDER_BLUE,
  textColor: TEXT_DARK,
  overflow: "linebreak" as const,
};

/**
 * Hook para garantir charSpace=0 em todas as células da `autoTable`,
 * evitando o glitch "C am po" causado por glifos não-mapeados.
 */
export const fixCharSpaceHook = {
  didDrawPage: (data: any) => { (data.doc as jsPDF as any).setCharSpace(0); },
  willDrawCell: (data: any) => { (data.doc as jsPDF as any).setCharSpace(0); },
};