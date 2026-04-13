import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

type ActionPlan = Tables<"action_plans">;

interface Props {
  plans: ActionPlan[];
  selectedUnit: string;
}

const PERIOD_LABELS: Record<string, string> = {
  ultimo_mes: "Último mês",
  ultimo_trimestre: "Último trimestre",
  ultimo_semestre: "Último semestre",
  todo: "Todo o período",
};

const TIPO_LABELS: Record<string, string> = {
  processo: "Processo", equipamento: "Equipamento", rh: "RH",
  insumo: "Insumo", infraestrutura: "Infraestrutura", outro: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  nao_iniciada: "Não iniciada", em_andamento: "Em andamento",
  concluida: "Concluída", cancelada: "Cancelada",
};

const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica",
};

const ActionPlanReportTab = ({ plans, selectedUnit }: Props) => {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("ultimo_trimestre");

  const filtered = selectedUnit === "Todas as unidades" ? plans : plans.filter(p => p.facility_unit === selectedUnit);
  const total = filtered.length;
  const concluidas = filtered.filter(p => p.status_acao === "concluida").length;
  const pendentes = filtered.filter(p => p.status_evidencia === "pendente").length;
  const criticas = filtered.filter(p => p.prioridade === "critica" || p.prioridade === "alta").length;
  const today = new Date();
  const vencidas = filtered.filter(p =>
    p.prazo && new Date(p.prazo + "T00:00:00") < today &&
    p.status_acao !== "concluida" && p.status_acao !== "cancelada"
  ).length;

  const stats = [
    { label: "Total de planos", value: total, color: "text-foreground" },
    { label: "Concluídas", value: concluidas, color: "text-success" },
    { label: "Evidências pendentes", value: pendentes, color: "text-warning" },
    { label: "Alta / Crítica", value: criticas, color: "text-destructive" },
  ];

  const generatePdfReport = async () => {
    setLoading(true);
    try {
      // 1. Get AI report
      const { data, error } = await supabase.functions.invoke("action-plan-report", {
        body: {
          facility_unit: selectedUnit === "Todas as unidades" ? null : selectedUnit,
          period,
        },
      });
      if (error) throw error;
      const reportText = data?.report || "Nenhum dado disponível para o período selecionado.";

      // 2. Generate PDF
      const { jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const margin = 15;
      let y = margin;
      const now = new Date().toLocaleDateString("pt-BR");

      const PRIMARY = [35, 66, 117];
      const DARK = [30, 40, 50];
      const MUTED = [120, 130, 140];
      const RED = [220, 60, 60];
      const GREEN = [40, 160, 90];
      const AMBER = [230, 160, 30];
      const WHITE = [255, 255, 255];
      const LIGHT_BG = [235, 239, 245];

      const addNewPageIfNeeded = (needed: number) => {
        if (y + needed > H - 20) { doc.addPage(); y = margin; drawPageHeader(); }
      };

      const drawPageHeader = () => {
        doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
        doc.rect(0, 0, W, 12, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("MOSS -- Relatorio de Plano de Acao", margin, 8);
        doc.text(now, W - margin, 8, { align: "right" });
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        y = 18;
      };

      const drawFooter = (pageNum: number, totalPages: number) => {
        doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
        doc.rect(0, H - 10, W, 10, "F");
        doc.setFontSize(7);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text("Gerado automaticamente pelo MOSS", margin, H - 4);
        doc.text(`Pagina ${pageNum} de ${totalPages}`, W - margin, H - 4, { align: "right" });
      };

      // Cover
      doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
      doc.rect(0, 0, W, 45, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("MOSS", margin, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Relatorio Inteligente de Plano de Acao", margin, 28);
      doc.setFontSize(9);
      doc.text(`${PERIOD_LABELS[period] || period}  |  ${selectedUnit}  |  ${now}`, margin, 38);
      y = 55;

      // Info box
      doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
      doc.roundedRect(margin, y, W - 2 * margin, 14, 3, 3, "F");
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Relatorio Consolidado - Planos de Acao", margin + 5, y + 6);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(`Unidade: ${selectedUnit}  |  Periodo: ${PERIOD_LABELS[period]}  |  ${total} planos analisados`, margin + 5, y + 12);
      y += 20;

      // KPI cards
      const cardW = (W - 2 * margin - 12) / 5;
      const kpis = [
        { label: "Total", value: `${total}`, color: PRIMARY },
        { label: "Concluidas", value: `${concluidas}`, color: GREEN },
        { label: "Ev. pendentes", value: `${pendentes}`, color: AMBER },
        { label: "Alta/Critica", value: `${criticas}`, color: RED },
        { label: "Vencidas", value: `${vencidas}`, color: RED },
      ];
      kpis.forEach((kpi, i) => {
        const x = margin + i * (cardW + 3);
        doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
        doc.setDrawColor(220, 222, 226);
        doc.roundedRect(x, y, cardW, 22, 2, 2, "FD");
        doc.setFontSize(6);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(kpi.label, x + 3, y + 6);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.text(kpi.value, x + 3, y + 17);
        doc.setFont("helvetica", "normal");
      });
      y += 30;

      // Summary tables: by status, priority, type
      addNewPageIfNeeded(50);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text("Distribuicao por Status", margin, y);
      y += 4;

      const statusData = Object.entries(
        filtered.reduce((acc, p) => { acc[p.status_acao] = (acc[p.status_acao] || 0) + 1; return acc; }, {} as Record<string, number>)
      ).map(([k, v]) => [STATUS_LABELS[k] || k, `${v}`, `${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%`]);

      autoTable(doc, {
        startY: y,
        head: [["Status", "Quantidade", "Percentual"]],
        body: statusData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3, lineColor: [220, 222, 226], lineWidth: 0.2 },
        headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 249, 252] },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // By priority
      addNewPageIfNeeded(40);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text("Distribuicao por Prioridade", margin, y);
      y += 4;

      const prioData = Object.entries(
        filtered.reduce((acc, p) => { acc[p.prioridade] = (acc[p.prioridade] || 0) + 1; return acc; }, {} as Record<string, number>)
      ).map(([k, v]) => [PRIORIDADE_LABELS[k] || k, `${v}`, `${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%`]);

      autoTable(doc, {
        startY: y,
        head: [["Prioridade", "Quantidade", "Percentual"]],
        body: prioData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3, lineColor: [220, 222, 226], lineWidth: 0.2 },
        headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 249, 252] },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // By type
      addNewPageIfNeeded(40);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text("Distribuicao por Tipo de Problema", margin, y);
      y += 4;

      const tipoData = Object.entries(
        filtered.reduce((acc, p) => { acc[p.tipo_problema] = (acc[p.tipo_problema] || 0) + 1; return acc; }, {} as Record<string, number>)
      ).map(([k, v]) => [TIPO_LABELS[k] || k, `${v}`, `${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%`]);

      autoTable(doc, {
        startY: y,
        head: [["Tipo de Problema", "Quantidade", "Percentual"]],
        body: tipoData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3, lineColor: [220, 222, 226], lineWidth: 0.2 },
        headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 249, 252] },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Full plans table
      addNewPageIfNeeded(30);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text("Detalhamento dos Planos de Acao", margin, y);
      y += 4;

      const plansTableData = filtered.map((p, i) => [
        `${i + 1}`,
        p.reference_name.length > 28 ? p.reference_name.substring(0, 28) + "..." : p.reference_name,
        TIPO_LABELS[p.tipo_problema] || p.tipo_problema,
        p.area || "-",
        PRIORIDADE_LABELS[p.prioridade] || p.prioridade,
        STATUS_LABELS[p.status_acao] || p.status_acao,
        p.responsavel || "Sem resp.",
        p.prazo || "-",
      ]);

      autoTable(doc, {
        startY: y,
        head: [["#", "Referencia", "Tipo", "Area", "Prioridade", "Status", "Responsavel", "Prazo"]],
        body: plansTableData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 6.5, cellPadding: 2, lineColor: [220, 222, 226], lineWidth: 0.2 },
        headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
        alternateRowStyles: { fillColor: [248, 249, 252] },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 40 },
          2: { cellWidth: 20 },
          3: { cellWidth: 22 },
          4: { cellWidth: 18 },
          5: { cellWidth: 20 },
          6: { cellWidth: 25 },
          7: { cellWidth: 18 },
        },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 5) {
            const val = data.cell.raw;
            if (val === "Concluída") data.cell.styles.textColor = GREEN;
            else if (val === "Em andamento") data.cell.styles.textColor = AMBER;
            else if (val === "Não iniciada") data.cell.styles.textColor = MUTED;
            else if (val === "Cancelada") data.cell.styles.textColor = RED;
            data.cell.styles.fontStyle = "bold";
          }
          if (data.section === "body" && data.column.index === 4) {
            const val = data.cell.raw;
            if (val === "Crítica") data.cell.styles.textColor = RED;
            else if (val === "Alta") data.cell.styles.textColor = [200, 100, 30];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // AI Report section
      addNewPageIfNeeded(30);
      doc.addPage();
      y = margin;
      drawPageHeader();

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
      doc.text("Analise Inteligente", margin, y);
      y += 3;
      doc.setDrawColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y);
      y += 8;

      // Render AI text with line wrapping
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);

      const cleanText = reportText
        .replace(/\*\*/g, "")
        .replace(/#{1,6}\s/g, "")
        .replace(/\*\s/g, "- ");

      const lines = cleanText.split("\n");
      const maxWidth = W - 2 * margin;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === "") {
          y += 3;
          continue;
        }

        // Detect section headers (lines that are all uppercase or start with number + period)
        const isHeader = /^(\d+\.\s|[A-ZÁÉÍÓÚÀÂÃÕÇ\s]{5,}$)/.test(trimmed);

        if (isHeader) {
          addNewPageIfNeeded(12);
          y += 3;
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
          const headerLines = doc.splitTextToSize(trimmed, maxWidth);
          doc.text(headerLines, margin, y);
          y += headerLines.length * 5 + 2;
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        } else {
          const wrappedLines = doc.splitTextToSize(trimmed, maxWidth);
          addNewPageIfNeeded(wrappedLines.length * 4 + 2);
          doc.text(wrappedLines, margin, y);
          y += wrappedLines.length * 4 + 1;
        }
      }

      // Footers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
      }

      // Download
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fileName = `MOSS_Plano_de_Acao_${selectedUnit.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Relatório PDF gerado!", { description: fileName });
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar relatório. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="kpi-card flex items-center gap-3 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-lg font-bold font-display ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Generate report */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-bold font-display">Gerar Relatório Inteligente em PDF</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          O relatório analisa todos os planos de ação, gera tabelas de distribuição por status, prioridade e tipo de problema,
          lista todos os planos detalhados e inclui uma análise inteligente com padrões de incidência, áreas críticas e recomendações priorizadas.
        </p>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ultimo_mes">Último mês</SelectItem>
              <SelectItem value="ultimo_trimestre">Último trimestre</SelectItem>
              <SelectItem value="ultimo_semestre">Último semestre</SelectItem>
              <SelectItem value="todo">Todo o período</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={generatePdfReport} disabled={loading || total === 0} size="sm">
            {loading ? "Gerando PDF..." : "Gerar relatório PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActionPlanReportTab;
