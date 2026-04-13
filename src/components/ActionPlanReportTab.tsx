import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

type ActionPlan = Tables<"action_plans">;

interface Props {
  plans: ActionPlan[];
  selectedUnit: string;
  availableUnits: string[];
}

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

const ActionPlanReportTab = ({ plans, selectedUnit, availableUnits }: Props) => {
  const [loading, setLoading] = useState(false);
  const [reportUnit, setReportUnit] = useState(selectedUnit);
  const [selectedPlanId, setSelectedPlanId] = useState("todos");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    return { from, to };
  });

  const startDate = dateRange.from.toISOString().slice(0, 10);
  const endDate = dateRange.to.toISOString().slice(0, 10);

  // Filter plans by unit and date range
  const filteredByUnitAndDate = useMemo(() => {
    let result = reportUnit === "Todas as unidades" ? plans : plans.filter(p => p.facility_unit === reportUnit);
    if (startDate) result = result.filter(p => p.created_at >= startDate + "T00:00:00");
    if (endDate) result = result.filter(p => p.created_at <= endDate + "T23:59:59");
    return result;
  }, [plans, reportUnit, startDate, endDate]);

  // Plans available for selection (filtered by unit + date)
  const plansForSelection = filteredByUnitAndDate;

  // Apply plan selection filter
  const filtered = useMemo(() => {
    if (selectedPlanId === "todos") return filteredByUnitAndDate;
    return filteredByUnitAndDate.filter(p => p.id === selectedPlanId);
  }, [filteredByUnitAndDate, selectedPlanId]);

  const total = filtered.length;
  const concluidas = filtered.filter(p => p.status_acao === "concluida").length;
  const pendentes = filtered.filter(p => p.status_evidencia === "pendente").length;
  const criticas = filtered.filter(p => p.prioridade === "critica" || p.prioridade === "alta").length;
  const today = new Date();
  const vencidas = filtered.filter(p =>
    p.prazo && new Date(p.prazo + "T00:00:00") < today &&
    p.status_acao !== "concluida" && p.status_acao !== "cancelada"
  ).length;

  // Group plans by unit for listing
  const plansByUnit = useMemo(() => {
    const map: Record<string, ActionPlan[]> = {};
    filtered.forEach(p => {
      if (!map[p.facility_unit]) map[p.facility_unit] = [];
      map[p.facility_unit].push(p);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const stats = [
    { label: "Total de planos", value: total, color: "text-foreground" },
    { label: "Concluídas", value: concluidas, color: "text-success" },
    { label: "Ev. pendentes", value: pendentes, color: "text-warning" },
    { label: "Alta / Crítica", value: criticas, color: "text-destructive" },
    { label: "Vencidas", value: vencidas, color: "text-destructive" },
  ];

  const generatePdfReport = async () => {
    setLoading(true);
    try {
      // 1. Get AI report — pass filtered plan IDs so the edge function only analyzes what's visible
      const filteredIds = filtered.map(p => p.id);
      const { data, error } = await supabase.functions.invoke("action-plan-report", {
        body: {
          facility_unit: reportUnit === "Todas as unidades" ? null : reportUnit,
          period: "custom",
          start_date: startDate || "2020-01-01",
          end_date: endDate,
          plan_ids: filteredIds.length < plans.length ? filteredIds : undefined,
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
      const margin = 14;
      let y = margin;
      const now = new Date().toLocaleDateString("pt-BR");
      const periodLabel = `${new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(endDate + "T00:00:00").toLocaleDateString("pt-BR")}`;

      const PRIMARY: [number, number, number] = [35, 66, 117];
      const DARK: [number, number, number] = [30, 40, 50];
      const MUTED: [number, number, number] = [120, 130, 140];
      const RED: [number, number, number] = [200, 55, 55];
      const GREEN: [number, number, number] = [40, 150, 85];
      const AMBER: [number, number, number] = [210, 145, 20];
      const WHITE: [number, number, number] = [255, 255, 255];
      const LIGHT_BG: [number, number, number] = [240, 243, 248];

      const addNewPageIfNeeded = (needed: number) => {
        if (y + needed > H - 18) { doc.addPage(); y = margin; drawPageHeader(); }
      };

      const drawPageHeader = () => {
        doc.setFillColor(...PRIMARY);
        doc.rect(0, 0, W, 11, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("MOSS — Relatorio de Plano de Acao", margin, 7);
        doc.setFont("helvetica", "normal");
        doc.text(now, W - margin, 7, { align: "right" });
        doc.setTextColor(...DARK);
        y = 16;
      };

      const drawFooter = (pageNum: number, totalPages: number) => {
        doc.setDrawColor(200, 205, 215);
        doc.setLineWidth(0.2);
        doc.line(margin, H - 10, W - margin, H - 10);
        doc.setFontSize(6);
        doc.setTextColor(...MUTED);
        doc.text("Gerado automaticamente pelo MOSS", margin, H - 5);
        doc.text(`Pagina ${pageNum} de ${totalPages}`, W - margin, H - 5, { align: "right" });
      };

      const drawSectionTitle = (title: string) => {
        addNewPageIfNeeded(16);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...PRIMARY);
        doc.text(title, margin, y);
        y += 2;
        doc.setDrawColor(...PRIMARY);
        doc.setLineWidth(0.4);
        doc.line(margin, y, W - margin, y);
        y += 6;
      };

      // ═══ COVER ═══
      doc.setFillColor(...PRIMARY);
      doc.rect(0, 0, W, 42, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("MOSS", margin, 18);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Relatorio Inteligente de Plano de Acao", margin, 26);
      doc.setFontSize(8);
      doc.setTextColor(220, 225, 240);
      doc.text(`${periodLabel}  |  ${reportUnit}  |  ${now}`, margin, 36);
      y = 50;

      // Info box
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(margin, y, W - 2 * margin, 12, 2, 2, "F");
      doc.setTextColor(...DARK);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Relatorio Consolidado — Planos de Acao", margin + 4, y + 5);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text(`Unidade: ${reportUnit}  |  Periodo: ${periodLabel}  |  ${total} planos analisados`, margin + 4, y + 10);
      y += 17;

      // KPI cards (5 inline)
      const cardW = (W - 2 * margin - 8) / 5;
      const kpis = [
        { label: "Total", value: `${total}`, color: PRIMARY },
        { label: "Concluidas", value: `${concluidas}`, color: GREEN },
        { label: "Ev. pendentes", value: `${pendentes}`, color: AMBER },
        { label: "Alta/Critica", value: `${criticas}`, color: RED },
        { label: "Vencidas", value: `${vencidas}`, color: RED },
      ];
      kpis.forEach((kpi, i) => {
        const x = margin + i * (cardW + 2);
        doc.setFillColor(...WHITE);
        doc.setDrawColor(215, 218, 225);
        doc.roundedRect(x, y, cardW, 20, 2, 2, "FD");
        doc.setFontSize(6);
        doc.setTextColor(...MUTED);
        doc.text(kpi.label, x + 3, y + 6);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...kpi.color);
        doc.text(kpi.value, x + 3, y + 16);
        doc.setFont("helvetica", "normal");
      });
      y += 26;

      // ═══ Summary tables ═══
      const tableStyles = {
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [215, 218, 225] as [number, number, number], lineWidth: 0.15 },
        headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: "bold" as const, fontSize: 7.5 },
        alternateRowStyles: { fillColor: [246, 248, 252] as [number, number, number] },
      };

      drawSectionTitle("Distribuicao por Status");
      const statusData = Object.entries(
        filtered.reduce((acc, p) => { acc[p.status_acao] = (acc[p.status_acao] || 0) + 1; return acc; }, {} as Record<string, number>)
      ).map(([k, v]) => [STATUS_LABELS[k] || k, `${v}`, `${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%`]);
      autoTable(doc, { startY: y, head: [["Status", "Quantidade", "Percentual"]], body: statusData, ...tableStyles });
      y = (doc as any).lastAutoTable.finalY + 6;

      drawSectionTitle("Distribuicao por Prioridade");
      const prioData = Object.entries(
        filtered.reduce((acc, p) => { acc[p.prioridade] = (acc[p.prioridade] || 0) + 1; return acc; }, {} as Record<string, number>)
      ).map(([k, v]) => [PRIORIDADE_LABELS[k] || k, `${v}`, `${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%`]);
      autoTable(doc, { startY: y, head: [["Prioridade", "Quantidade", "Percentual"]], body: prioData, ...tableStyles });
      y = (doc as any).lastAutoTable.finalY + 6;

      drawSectionTitle("Distribuicao por Tipo de Problema");
      const tipoData = Object.entries(
        filtered.reduce((acc, p) => { acc[p.tipo_problema] = (acc[p.tipo_problema] || 0) + 1; return acc; }, {} as Record<string, number>)
      ).map(([k, v]) => [TIPO_LABELS[k] || k, `${v}`, `${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%`]);
      autoTable(doc, { startY: y, head: [["Tipo de Problema", "Quantidade", "Percentual"]], body: tipoData, ...tableStyles });
      y = (doc as any).lastAutoTable.finalY + 8;

      // ═══════════════════════════════════════════════
      // PARETO CHART — Incidência por Tipo de Problema
      // ═══════════════════════════════════════════════
      addNewPageIfNeeded(110);

      drawSectionTitle("Diagrama de Pareto — Incidencia por Tipo de Problema");

      // Build sorted data
      const paretoRaw = filtered.reduce((acc, p) => {
        const label = TIPO_LABELS[p.tipo_problema] || p.tipo_problema;
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const paretoSorted = Object.entries(paretoRaw).sort((a, b) => b[1] - a[1]);
      const paretoTotal = paretoSorted.reduce((s, [, v]) => s + v, 0);

      if (paretoSorted.length > 0 && paretoTotal > 0) {
        const chartX = margin + 5;
        const chartY = y;
        const chartW = W - 2 * margin - 10;
        const chartH = 75;
        const barColors = [
          [35, 66, 117], [220, 60, 60], [230, 160, 30],
          [40, 160, 90], [150, 100, 200], [80, 180, 200],
        ];
        const barCount = paretoSorted.length;
        const barGap = 4;
        const barW = Math.min(30, (chartW - barGap * (barCount + 1)) / barCount);
        const maxVal = paretoSorted[0][1];
        const barAreaW = barCount * (barW + barGap) + barGap;
        const offsetX = chartX + (chartW - barAreaW) / 2;

        // Y axis
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(chartX, chartY, chartX, chartY + chartH);
        doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);

        // Y axis labels
        for (let i = 0; i <= 4; i++) {
          const yLine = chartY + chartH - (chartH * i) / 4;
          doc.setDrawColor(235, 237, 240);
          doc.setLineWidth(0.1);
          doc.line(chartX + 1, yLine, chartX + chartW, yLine);
          doc.setFontSize(6);
          doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
          doc.text(`${Math.round((maxVal * i) / 4)}`, chartX - 2, yLine + 1, { align: "right" });
        }

        // Right Y axis label (%)
        doc.setFontSize(6);
        doc.setTextColor(RED[0], RED[1], RED[2]);
        doc.text("100%", chartX + chartW + 2, chartY + 2);
        doc.text("50%", chartX + chartW + 2, chartY + chartH / 2 + 1);
        doc.text("0%", chartX + chartW + 2, chartY + chartH + 1);

        // Bars
        let cumulative = 0;
        const cumulativePoints: { x: number; y: number }[] = [];

        paretoSorted.forEach(([label, val], i) => {
          const barH = (val / maxVal) * (chartH - 5);
          const bx = offsetX + barGap + i * (barW + barGap);
          const by = chartY + chartH - barH;
          const color = barColors[i % barColors.length];

          doc.setFillColor(color[0], color[1], color[2]);
          doc.roundedRect(bx, by, barW, barH, 1, 1, "F");

          // Value on top
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(color[0], color[1], color[2]);
          doc.text(`${val}`, bx + barW / 2, by - 2, { align: "center" });

          // Label below
          doc.setFontSize(6.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(DARK[0], DARK[1], DARK[2]);
          const truncLabel = label.length > 12 ? label.substring(0, 11) + "." : label;
          doc.text(truncLabel, bx + barW / 2, chartY + chartH + 5, { align: "center" });

          // Cumulative line point
          cumulative += val;
          cumulativePoints.push({
            x: bx + barW / 2,
            y: chartY + chartH - (cumulative / paretoTotal) * (chartH - 5),
          });
        });

        // Cumulative line
        doc.setDrawColor(RED[0], RED[1], RED[2]);
        doc.setLineWidth(0.6);
        for (let i = 1; i < cumulativePoints.length; i++) {
          doc.line(cumulativePoints[i - 1].x, cumulativePoints[i - 1].y, cumulativePoints[i].x, cumulativePoints[i].y);
        }
        // Dots
        cumulativePoints.forEach((pt, i) => {
          doc.setFillColor(RED[0], RED[1], RED[2]);
          doc.circle(pt.x, pt.y, 1.2, "F");
          const pct = Math.round(((paretoSorted.slice(0, i + 1).reduce((s, [, v]) => s + v, 0)) / paretoTotal) * 100);
          doc.setFontSize(6);
          doc.setTextColor(RED[0], RED[1], RED[2]);
          doc.text(`${pct}%`, pt.x, pt.y - 3, { align: "center" });
        });

        // Legend
        y = chartY + chartH + 12;
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text("Barras: frequencia absoluta por tipo  |  Linha vermelha: percentual acumulado (Pareto)", margin, y);
        y += 8;

        // 80/20 insight
        const count80 = (() => {
          let acc = 0;
          for (let i = 0; i < paretoSorted.length; i++) {
            acc += paretoSorted[i][1];
            if (acc / paretoTotal >= 0.8) return i + 1;
          }
          return paretoSorted.length;
        })();
        doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
        doc.roundedRect(margin, y, W - 2 * margin, 12, 2, 2, "F");
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
        doc.text("Regra 80/20:", margin + 4, y + 5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        doc.text(
          `${count80} de ${paretoSorted.length} tipos de problema concentram 80% das ocorrencias (${paretoSorted.slice(0, count80).map(([l]) => l).join(", ")})`,
          margin + 30, y + 5
        );
        y += 18;
      }

      // ═══════════════════════════════════════════════
      // PARETO CHART 2 — Incidência por Área/Setor
      // ═══════════════════════════════════════════════
      const areaRaw = filtered.reduce((acc, p) => {
        const label = p.area || "Sem area";
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const areaSorted = Object.entries(areaRaw).sort((a, b) => b[1] - a[1]);
      const areaTotal = areaSorted.reduce((s, [, v]) => s + v, 0);

      if (areaSorted.length > 0 && areaTotal > 0) {
        addNewPageIfNeeded(100);

        drawSectionTitle("Diagrama de Pareto — Incidencia por Area/Setor");

        const chartX2 = margin + 5;
        const chartY2 = y;
        const chartW2 = W - 2 * margin - 10;
        const chartH2 = 65;
        const barColors2 = [
          [40, 160, 90], [35, 66, 117], [230, 160, 30],
          [220, 60, 60], [150, 100, 200], [80, 180, 200], [200, 100, 30],
        ];
        const barCount2 = areaSorted.length;
        const barGap2 = 3;
        const barW2 = Math.min(25, (chartW2 - barGap2 * (barCount2 + 1)) / barCount2);
        const maxVal2 = areaSorted[0][1];
        const barAreaW2 = barCount2 * (barW2 + barGap2) + barGap2;
        const offsetX2 = chartX2 + (chartW2 - barAreaW2) / 2;

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(chartX2, chartY2, chartX2, chartY2 + chartH2);
        doc.line(chartX2, chartY2 + chartH2, chartX2 + chartW2, chartY2 + chartH2);

        let cum2 = 0;
        const cumPts2: { x: number; y: number }[] = [];
        areaSorted.forEach(([label, val], i) => {
          const barH = (val / maxVal2) * (chartH2 - 5);
          const bx = offsetX2 + barGap2 + i * (barW2 + barGap2);
          const by = chartY2 + chartH2 - barH;
          const color = barColors2[i % barColors2.length];

          doc.setFillColor(color[0], color[1], color[2]);
          doc.roundedRect(bx, by, barW2, barH, 1, 1, "F");

          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(color[0], color[1], color[2]);
          doc.text(`${val}`, bx + barW2 / 2, by - 2, { align: "center" });

          doc.setFontSize(6);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(DARK[0], DARK[1], DARK[2]);
          const tl = label.length > 14 ? label.substring(0, 13) + "." : label;
          doc.text(tl, bx + barW2 / 2, chartY2 + chartH2 + 5, { align: "center" });

          cum2 += val;
          cumPts2.push({ x: bx + barW2 / 2, y: chartY2 + chartH2 - (cum2 / areaTotal) * (chartH2 - 5) });
        });

        doc.setDrawColor(RED[0], RED[1], RED[2]);
        doc.setLineWidth(0.6);
        for (let i = 1; i < cumPts2.length; i++) {
          doc.line(cumPts2[i - 1].x, cumPts2[i - 1].y, cumPts2[i].x, cumPts2[i].y);
        }
        cumPts2.forEach((pt) => { doc.setFillColor(RED[0], RED[1], RED[2]); doc.circle(pt.x, pt.y, 1, "F"); });

        y = chartY2 + chartH2 + 12;
        doc.setFontSize(7);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text("Barras: frequencia por area  |  Linha: acumulado", margin, y);
        y += 10;
      }

      // ═══════════════════════════════════════════════
      // ISHIKAWA (Fishbone) DIAGRAM
      // ═══════════════════════════════════════════════
      addNewPageIfNeeded(120);

      drawSectionTitle("Diagrama de Ishikawa — Analise de Causa e Efeito");

      // Build Ishikawa categories from real data
      const ishikawaCategories: { name: string; color: number[]; causes: string[] }[] = [
        {
          name: "Processo",
          color: [35, 66, 117],
          causes: filtered.filter(p => p.tipo_problema === "processo").map(p => p.causa_raiz || p.reference_name).slice(0, 4),
        },
        {
          name: "Mao de Obra (RH)",
          color: [220, 60, 60],
          causes: filtered.filter(p => p.tipo_problema === "rh").map(p => p.causa_raiz || p.reference_name).slice(0, 4),
        },
        {
          name: "Material / Insumo",
          color: [230, 160, 30],
          causes: filtered.filter(p => p.tipo_problema === "insumo").map(p => p.causa_raiz || p.reference_name).slice(0, 4),
        },
        {
          name: "Equipamento",
          color: [150, 100, 200],
          causes: filtered.filter(p => p.tipo_problema === "equipamento").map(p => p.causa_raiz || p.reference_name).slice(0, 4),
        },
        {
          name: "Infraestrutura",
          color: [40, 160, 90],
          causes: filtered.filter(p => p.tipo_problema === "infraestrutura").map(p => p.causa_raiz || p.reference_name).slice(0, 4),
        },
        {
          name: "Outros",
          color: [80, 180, 200],
          causes: filtered.filter(p => p.tipo_problema === "outro").map(p => p.causa_raiz || p.reference_name).slice(0, 4),
        },
      ].filter(c => c.causes.length > 0);

      // Draw fishbone
      const fishX = margin;
      const fishW = W - 2 * margin;
      const fishCenterY = y + 55;
      const headX = fishX + fishW;
      const spineStartX = fishX + 10;

      // Main spine (horizontal arrow)
      doc.setDrawColor(DARK[0], DARK[1], DARK[2]);
      doc.setLineWidth(1);
      doc.line(spineStartX, fishCenterY, headX - 20, fishCenterY);

      // Arrow head (effect box)
      doc.setFillColor(RED[0], RED[1], RED[2]);
      doc.roundedRect(headX - 40, fishCenterY - 8, 40, 16, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Nao", headX - 38, fishCenterY - 1);
      doc.text("Conformidade", headX - 38, fishCenterY + 5);

      // Distribute categories: top and bottom
      const topCats = ishikawaCategories.filter((_, i) => i % 2 === 0);
      const botCats = ishikawaCategories.filter((_, i) => i % 2 === 1);
      const spineLen = headX - 20 - spineStartX;

      const drawBranch = (cat: typeof ishikawaCategories[0], idx: number, count: number, isTop: boolean) => {
        const spacing = spineLen / (count + 1);
        const bx = spineStartX + spacing * (idx + 1);
        const branchLen = 35;
        const endY = isTop ? fishCenterY - branchLen : fishCenterY + branchLen;

        // Branch line
        doc.setDrawColor(cat.color[0], cat.color[1], cat.color[2]);
        doc.setLineWidth(0.7);
        doc.line(bx, fishCenterY, bx - 10, endY);

        // Category label
        doc.setFillColor(cat.color[0], cat.color[1], cat.color[2]);
        const labelW = doc.getTextWidth(cat.name) * 0.75 + 6;
        const labelY = isTop ? endY - 6 : endY + 1;
        doc.roundedRect(bx - 10 - labelW / 2, labelY, labelW, 5.5, 1.5, 1.5, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.text(cat.name, bx - 10, labelY + 4, { align: "center" });

        // Causes (sub-branches)
        cat.causes.forEach((cause, ci) => {
          const subOffset = (ci + 1) * (branchLen / (cat.causes.length + 1));
          const subY = isTop ? fishCenterY - subOffset : fishCenterY + subOffset;

          doc.setDrawColor(cat.color[0], cat.color[1], cat.color[2]);
          doc.setLineWidth(0.3);
          const interpX = bx - (10 * subOffset) / branchLen;
          doc.line(interpX, subY, interpX - 18, subY);

          doc.setFontSize(5.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(DARK[0], DARK[1], DARK[2]);
          const truncCause = cause.length > 30 ? cause.substring(0, 29) + "..." : cause;
          doc.text(truncCause, interpX - 19, subY - 1, { align: "right" });
        });
      };

      topCats.forEach((cat, i) => drawBranch(cat, i, topCats.length, true));
      botCats.forEach((cat, i) => drawBranch(cat, i, botCats.length, false));

      y = fishCenterY + 50;

      // Ishikawa summary table
      addNewPageIfNeeded(40);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text("Detalhamento das Causas Raiz Identificadas", margin, y);
      y += 4;

      const causaData = filtered
        .filter(p => p.causa_raiz)
        .map(p => [
          p.reference_name.length > 30 ? p.reference_name.substring(0, 29) + "..." : p.reference_name,
          TIPO_LABELS[p.tipo_problema] || p.tipo_problema,
          p.area || "-",
          (p.causa_raiz || "").length > 45 ? (p.causa_raiz || "").substring(0, 44) + "..." : (p.causa_raiz || ""),
          PRIORIDADE_LABELS[p.prioridade] || p.prioridade,
        ]);

      if (causaData.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Referencia", "Tipo", "Area", "Causa Raiz", "Prioridade"]],
          body: causaData,
          margin: { left: margin, right: margin },
          styles: { fontSize: 7, cellPadding: 2.5, lineColor: [220, 222, 226], lineWidth: 0.2 },
          headStyles: { fillColor: [PRIMARY[0], PRIMARY[1], PRIMARY[2]], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 249, 252] },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 22 },
            2: { cellWidth: 22 },
            3: { cellWidth: 65 },
            4: { cellWidth: 18 },
          },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // ═══════════════ Reincidência ═══════════════
      const reincidencias = Object.entries(
        filtered.reduce((acc, p) => { acc[p.reference_name] = (acc[p.reference_name] || 0) + 1; return acc; }, {} as Record<string, number>)
      ).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]);

      if (reincidencias.length > 0) {
        addNewPageIfNeeded(40);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(RED[0], RED[1], RED[2]);
        doc.text("Reincidencias Identificadas", margin, y);
        y += 4;

        autoTable(doc, {
          startY: y,
          head: [["Referencia", "Ocorrencias", "Observacao"]],
          body: reincidencias.map(([name, count]) => [name, `${count}`, "Requer atencao especial - multiplos planos para mesma referencia"]),
          margin: { left: margin, right: margin },
          styles: { fontSize: 7.5, cellPadding: 3, lineColor: [220, 222, 226], lineWidth: 0.2 },
          headStyles: { fillColor: [RED[0], RED[1], RED[2]], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [255, 248, 248] },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="kpi-card flex items-center gap-3 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-lg font-bold font-display ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Plans by unit listing */}
      {plansByUnit.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-3">
          <h3 className="text-sm font-bold font-display">Planos por Unidade no Período</h3>
          <div className="space-y-2">
            {plansByUnit.map(([unit, unitPlans]) => {
              const unitConcluidas = unitPlans.filter(p => p.status_acao === "concluida").length;
              const unitVencidas = unitPlans.filter(p =>
                p.prazo && new Date(p.prazo + "T00:00:00") < today &&
                p.status_acao !== "concluida" && p.status_acao !== "cancelada"
              ).length;
              return (
                <div key={unit} className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg bg-muted/30 border border-border">
                  <span className="text-sm font-medium text-foreground">{unit}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">{unitPlans.length} planos</span>
                    <span className="text-success font-medium">{unitConcluidas} concluídos</span>
                    {unitVencidas > 0 && <span className="text-destructive font-medium">{unitVencidas} vencidos</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Generate report */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-bold font-display">Gerar Relatório Inteligente em PDF</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          O relatório inclui diagramas de Pareto e Ishikawa, tabelas de distribuição, detalhamento dos planos
          e uma análise inteligente com padrões de incidência, áreas críticas e recomendações priorizadas.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Unidade</Label>
            <Select value={reportUnit} onValueChange={setReportUnit}>
              <SelectTrigger className="w-48 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableUnits.length > 1 && <SelectItem value="Todas as unidades">Todas as unidades</SelectItem>}
                {availableUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-64 h-9 justify-start text-left text-xs font-normal")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} — {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) setDateRange({ from: range.from, to: range.to });
                    else if (range?.from) setDateRange({ from: range.from, to: range.from });
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Plano de ação</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="w-56 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os planos ({plansForSelection.length})</SelectItem>
                {plansForSelection.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.reference_name.length > 35 ? p.reference_name.substring(0, 32) + "..." : p.reference_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generatePdfReport} disabled={loading || total === 0} size="sm">
            {loading ? "Gerando PDF..." : "Gerar relatório PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActionPlanReportTab;
