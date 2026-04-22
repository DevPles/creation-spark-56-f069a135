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

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header band
  doc.setFillColor(13, 79, 79);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Requisição de Compra", margin, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nº ${req.numero || "—"}`, margin, 50);
  doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageW - margin, 50, { align: "right" });

  doc.setTextColor(20, 20, 20);
  let y = 100;

  // Header data
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [232, 240, 240], textColor: 20, fontStyle: "bold" },
    head: [["Campo", "Valor"]],
    body: [
      ["Nº da Requisição", req.numero || "—"],
      ["Data da Requisição", fmtDate(req.data_requisicao)],
      ["Unidade", req.facility_unit || "—"],
      ["Município", req.municipio || "—"],
      ["Setor", req.setor || "—"],
      ["Solicitante", req.solicitante_nome || "—"],
      ["Aprovador imediato", req.aprovador_imediato_nome || "—"],
      ["Aprovador da diretoria", req.aprovador_diretoria_nome || "—"],
      ["Classificação", (req.classificacao || []).join(", ") || "—"],
      ["Justificativa / tipo", req.justificativa_tipo || "—"],
      ["Status", req.status || "—"],
    ],
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 16;

  // Items
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Itens solicitados", margin, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [13, 79, 79], textColor: 255, fontStyle: "bold" },
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

  y = (doc as any).lastAutoTable.finalY + 20;

  // Observations
  if (req.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Observações", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(req.observacoes, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 10;
  }

  // Signatures
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 140) {
    doc.addPage();
    y = 80;
  } else {
    y = Math.max(y + 30, pageH - 140);
  }
  const colW = (pageW - margin * 2 - 20) / 2;
  doc.setDrawColor(120);
  doc.line(margin, y, margin + colW, y);
  doc.line(margin + colW + 20, y, pageW - margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(req.aprovador_imediato_nome || "Aprovador imediato", margin + colW / 2, y + 14, { align: "center" });
  doc.text(req.aprovador_diretoria_nome || "Aprovador da diretoria", margin + colW + 20 + colW / 2, y + 14, { align: "center" });

  doc.save(`requisicao-${req.numero || requisitionId}.pdf`);
}