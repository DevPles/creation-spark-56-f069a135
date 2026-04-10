import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { AlertTriangle, FileDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useContracts } from "@/contexts/ContractsContext";
import RubricaFormModal from "@/components/RubricaFormModal";
import { ContractData } from "@/components/contract/types";
import { MONTHS } from "@/data/rubricaData";
import { toast } from "sonner";

const formatCurrency = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
};
const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };
const PIE_COLORS = ["hsl(var(--primary))", "hsl(38 92% 50%)", "hsl(142 71% 45%)", "hsl(280 70% 50%)", "hsl(var(--destructive))", "hsl(190 80% 45%)"];

const ControleRubricaPage = () => {
  const navigate = useNavigate();
  const { contracts, updateContract } = useContracts();
  const [selectedContract, setSelectedContract] = useState("all");
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [rubricaModalOpen, setRubricaModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractData | null>(null);

  // Build rubrica data from contracts
  const byRubrica = useMemo(() => {
    const filteredContracts = selectedContract === "all"
      ? contracts
      : contracts.filter(c => c.unit === selectedContract);

    const map: Record<string, { allocated: number; executed: number }> = {};

    filteredContracts.forEach(c => {
      (c.rubricas || []).forEach(r => {
        if (r.percent <= 0 || !r.name) return;
        const allocated = c.value * (r.percent / 100);
        // Simulate execution rates for demo
        const seed = r.name.length + c.value;
        const executionRate = r.name === "Insumos e Materiais" && c.unit === "Hospital Geral"
          ? 1.16 : (0.7 + ((seed % 30) / 100));
        const executed = allocated * Math.min(1.2, executionRate);

        if (!map[r.name]) map[r.name] = { allocated: 0, executed: 0 };
        map[r.name].allocated += allocated;
        map[r.name].executed += executed;
      });
    });

    return Object.entries(map).map(([name, v]) => ({
      name,
      allocated: v.allocated,
      executed: v.executed,
      pctExec: v.allocated > 0 ? Math.round((v.executed / v.allocated) * 100) : 0,
      estourada: v.executed > v.allocated,
    })).sort((a, b) => b.allocated - a.allocated);
  }, [contracts, selectedContract]);

  const byMonth = useMemo(() => {
    const filteredContracts = selectedContract === "all"
      ? contracts
      : contracts.filter(c => c.unit === selectedContract);

    const totalAllocated = filteredContracts.reduce((s, c) => s + c.value, 0);

    return MONTHS.map((m, i) => {
      const factor = 0.7 + ((i * 7 + 3) % 30) / 100;
      return {
        month: m,
        alocado: totalAllocated / 1000,
        executado: (totalAllocated * factor) / 1000,
      };
    });
  }, [contracts, selectedContract]);

  const totalAllocated = byRubrica.reduce((s, r) => s + r.allocated, 0);
  const totalExecuted = byRubrica.reduce((s, r) => s + r.executed, 0);
  const avgExecution = totalAllocated > 0 ? Math.round((totalExecuted / totalAllocated) * 100) : 0;
  const overBudget = byRubrica.filter(r => r.estourada).length;
  const underBudget = byRubrica.filter(r => r.pctExec < 70).length;
  const pieData = byRubrica.map(r => ({ name: r.name, value: r.allocated }));

  const handleOpenRubricaModal = (contractId?: string) => {
    const contract = contractId
      ? contracts.find(c => c.id === contractId)
      : contracts.find(c => c.unit === selectedContract) || contracts[0];
    if (contract) {
      setEditingContract(contract);
      setRubricaModalOpen(true);
    }
  };

  const handleSaveRubricas = (updated: ContractData) => {
    updateContract(updated);
  };

  const handleGeneratePdf = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const primary: [number, number, number] = [35, 66, 117];
    const accent: [number, number, number] = [55, 95, 155];
    const lightBg: [number, number, number] = [235, 239, 245];
    const margin = 14;
    const contentW = pageW - margin * 2;
    const now = new Date();

    doc.setFillColor(...primary);
    doc.rect(0, 0, pageW, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("MOSS", margin, 18);
    doc.setFontSize(9);
    doc.text("Métricas para Organizações de Serviço Social", margin, 26);
    doc.setFontSize(11);
    doc.text("Relatório de Controle de Rubrica", margin, 34);
    doc.setFontSize(8);
    const unitLabel = selectedContract === "all" ? "Todos os contratos" : selectedContract;
    const monthLabel = selectedMonth === "all" ? "Todos os meses" : selectedMonth;
    doc.text(`${unitLabel} • ${selectedYear} • ${monthLabel} • ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, pageW - margin, 34, { align: "right" });

    let y = 48;

    const kpis = [
      { label: "Total alocado", value: formatCurrency(totalAllocated) },
      { label: "Total executado", value: formatCurrency(totalExecuted) },
      { label: "Execução", value: `${avgExecution}%` },
      { label: "Rubricas estouradas", value: String(overBudget) },
    ];
    const boxW = (contentW - 18) / 4;
    kpis.forEach((kpi, i) => {
      const x = margin + i * (boxW + 6);
      doc.setFillColor(...lightBg);
      doc.roundedRect(x, y, boxW, 22, 3, 3, "F");
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.text(kpi.label, x + 4, y + 8);
      doc.setTextColor(...primary);
      doc.setFontSize(16);
      doc.text(kpi.value, x + 4, y + 18);
    });
    y += 30;

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(11);
    doc.text("Execução por Rubrica", margin, y + 4);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Rubrica", "Alocado", "Executado", "% Exec.", "Status"]],
      body: byRubrica.map(r => [
        r.name,
        formatCurrency(r.allocated),
        formatCurrency(r.executed),
        `${r.pctExec}%`,
        r.estourada ? "ESTOURADA" : r.pctExec < 70 ? "ABAIXO 70%" : "OK",
      ]),
      headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 4) {
          const val = data.cell.raw;
          if (val === "ESTOURADA") data.cell.styles.textColor = [220, 50, 50];
          else if (val === "OK") data.cell.styles.textColor = [46, 160, 67];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    if (y + 60 > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
    doc.setFillColor(...lightBg);
    doc.roundedRect(margin, y, contentW, 55, 3, 3, "F");
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.text("Alocado vs Executado por Rubrica", margin + 4, y + 10);

    const chartY = y + 16;
    const barAreaW = contentW - 60;
    const maxVal = Math.max(...byRubrica.map(r => Math.max(r.allocated, r.executed)), 1);
    byRubrica.slice(0, 6).forEach((r, i) => {
      const rowY = chartY + i * 6;
      if (rowY + 6 > y + 53) return;
      const barX = margin + 50;
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(6);
      doc.text(r.name.substring(0, 18), margin + 4, rowY + 4);
      doc.setFillColor(180, 195, 215);
      doc.roundedRect(barX, rowY, (r.allocated / maxVal) * barAreaW, 2.5, 0.5, 0.5, "F");
      doc.setFillColor(...(r.estourada ? [220, 50, 50] as [number, number, number] : accent));
      doc.roundedRect(barX, rowY + 2.8, (r.executed / maxVal) * barAreaW, 2.5, 0.5, 0.5, "F");
    });
    y += 60;

    if (y + 30 > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(11);
    doc.text("Evolução Mensal (R$ mil)", margin, y + 4);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Mês", "Alocado (R$ mil)", "Executado (R$ mil)", "% Exec."]],
      body: byMonth.map(m => [
        m.month,
        `R$ ${m.alocado.toFixed(0)}k`,
        `R$ ${m.executado.toFixed(0)}k`,
        `${m.alocado > 0 ? Math.round((m.executado / m.alocado) * 100) : 0}%`,
      ]),
      headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(...primary);
      doc.rect(0, doc.internal.pageSize.getHeight() - 10, pageW, 10, "F");
      doc.setTextColor(200, 210, 225);
      doc.setFontSize(7);
      doc.text("MOSS — Controle de Rubrica", margin, doc.internal.pageSize.getHeight() - 4);
      doc.text(`Página ${p} de ${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 4, { align: "right" });
    }

    doc.save(`rubrica_${unitLabel.replace(/\\s/g, "_")}_${selectedYear}_${monthLabel}.pdf`);
    toast.success("PDF gerado com sucesso!");
  };


  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          ← Voltar
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Controle de Rubrica</h1>
            <p className="text-sm text-muted-foreground">Gestão e acompanhamento de rubricas por contrato</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedContract} onValueChange={setSelectedContract}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os contratos</SelectItem>
                {contracts.map(c => <SelectItem key={c.id} value={c.unit}>{c.unit}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="default" size="sm" className="h-9" onClick={handleGeneratePdf}>
              <FileDown className="h-4 w-4 mr-1" /> Gerar PDF
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => handleOpenRubricaModal()}>
              Gerenciar Rubricas
            </Button>
          </div>
        </div>

        {/* Estouradas alert banner */}
        {overBudget > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 mb-6 rounded-lg border border-destructive/30 bg-destructive/5"
          >
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {overBudget} rubrica{overBudget > 1 ? "s" : ""} estourada{overBudget > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {byRubrica.filter(r => r.estourada).map(r => r.name).join(", ")} — pendência de evidência de justificativa em Evidências
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => navigate("/evidencias")}>
              Ver Evidências
            </Button>
          </motion.div>
        )}

        {byRubrica.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-2">Nenhuma rubrica cadastrada para este contrato.</p>
            <Button onClick={() => handleOpenRubricaModal()}>
              Cadastrar Rubricas
            </Button>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <div className="kpi-card">
                  <p className="text-xs text-muted-foreground">Total alocado</p>
                  <p className="font-display text-2xl font-bold text-foreground">{formatCurrency(totalAllocated)}</p>
                  <p className="text-[10px] text-muted-foreground">{byRubrica.length} rubricas ativas</p>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="kpi-card">
                  <p className="text-xs text-muted-foreground">Total executado</p>
                  <p className="font-display text-2xl font-bold" style={{ color: avgExecution >= 90 ? "hsl(142 71% 45%)" : avgExecution >= 70 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))" }}>{formatCurrency(totalExecuted)}</p>
                  <p className="text-[10px] text-muted-foreground">{avgExecution}% de execução</p>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <div className="kpi-card">
                  <p className="text-xs text-muted-foreground">Saldo disponível</p>
                  <p className="font-display text-2xl font-bold text-foreground">{formatCurrency(totalAllocated - totalExecuted)}</p>
                  <p className="text-[10px] text-muted-foreground">{100 - avgExecution}% restante</p>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <div className="kpi-card">
                  <p className="text-xs text-muted-foreground">Rubricas estouradas</p>
                  <div className="flex items-center gap-2">
                    <p className="font-display text-2xl font-bold text-destructive">{overBudget}</p>
                    {overBudget > 0 && <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{underBudget} abaixo de 70%</p>
                </div>
              </motion.div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="kpi-card">
                <p className="text-sm font-medium text-foreground mb-3">Distribuição por rubrica</p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="kpi-card">
                <p className="text-sm font-medium text-foreground mb-3">Alocado vs Executado (R$ mil)</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byMonth} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickFormatter={v => `${v}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `R$ ${v.toFixed(0)}k`} />
                    <Bar dataKey="alocado" fill="hsl(var(--primary) / 0.3)" radius={[6, 6, 0, 0]} name="Alocado" />
                    <Bar dataKey="executado" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Executado" />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Execution by rubrica */}
            <div className="kpi-card mb-6">
              <p className="text-sm font-medium text-foreground mb-3">Execução por rubrica</p>
              <ResponsiveContainer width="100%" height={Math.max(200, byRubrica.length * 45)}>
                <BarChart data={byRubrica.map(r => ({ name: r.name, execução: r.pctExec }))} layout="vertical" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" domain={[0, 120]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="execução" radius={[0, 6, 6, 0]} name="% Executado">
                    {byRubrica.map((r, i) => (
                      <Cell key={i} fill={r.estourada ? "hsl(var(--destructive))" : r.pctExec >= 70 ? "hsl(var(--primary))" : "hsl(38 92% 50%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed table */}
            <div className="kpi-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">Detalhamento por rubrica</p>
                <span className="text-xs text-muted-foreground">{byRubrica.length} rubricas</span>
              </div>
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] font-medium text-muted-foreground border-b border-border">
                  <span className="col-span-3">Rubrica</span>
                  <span className="col-span-2 text-right">Alocado</span>
                  <span className="col-span-2 text-right">Executado</span>
                  <span className="col-span-2 text-right">Saldo</span>
                  <span className="col-span-2 text-right">Execução</span>
                  <span className="col-span-1 text-right">Status</span>
                </div>
                {byRubrica.map((r, i) => {
                  const saldo = r.allocated - r.executed;
                  const statusClass = r.estourada ? "status-critical" : r.pctExec >= 70 ? "status-success" : "status-warning";
                  const statusLabel = r.estourada ? "Estourada" : r.pctExec >= 70 ? "OK" : "Baixo";
                  return (
                    <motion.div
                      key={r.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`grid grid-cols-12 px-4 py-3 text-sm items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${r.estourada ? "bg-destructive/5" : ""}`}
                    >
                      <span className="col-span-3 font-medium text-foreground text-xs flex items-center gap-1.5">
                        {r.estourada && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                        {r.name}
                      </span>
                      <span className="col-span-2 text-right text-xs text-muted-foreground">{formatCurrency(r.allocated)}</span>
                      <span className={`col-span-2 text-right text-xs font-medium ${r.estourada ? "text-destructive" : "text-foreground"}`}>{formatCurrency(r.executed)}</span>
                      <span className={`col-span-2 text-right text-xs font-medium ${saldo < 0 ? "text-destructive" : "text-foreground"}`}>{formatCurrency(saldo)}</span>
                      <span className="col-span-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(r.pctExec, 100)}%`,
                                background: r.estourada ? "hsl(var(--destructive))" : r.pctExec >= 70 ? "hsl(var(--primary))" : "hsl(38 92% 50%)",
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{r.pctExec}%</span>
                        </div>
                      </span>
                      <span className="col-span-1 text-right">
                        <span className={`status-badge text-[10px] ${statusClass}`}>{statusLabel}</span>
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Per-contract rubrica management */}
            {selectedContract !== "all" && (
              <div className="kpi-card mt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-foreground">Rubricas do contrato: {selectedContract}</p>
                  <Button variant="outline" size="sm" onClick={() => handleOpenRubricaModal()}>
                    Editar
                  </Button>
                </div>
                {(() => {
                  const contract = contracts.find(c => c.unit === selectedContract);
                  if (!contract?.rubricas?.length) return <p className="text-sm text-muted-foreground">Nenhuma rubrica cadastrada.</p>;
                  return (
                    <div className="space-y-2">
                      {contract.rubricas.filter(r => r.percent > 0).map(r => (
                        <div key={r.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                          <span className="text-sm text-foreground">{r.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">{r.percent}%</span>
                            <span className="text-xs font-medium text-foreground">{formatCurrency(contract.value * (r.percent / 100))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </main>

      {editingContract && (
        <RubricaFormModal
          open={rubricaModalOpen}
          onOpenChange={setRubricaModalOpen}
          contract={editingContract}
          onSave={handleSaveRubricas}
        />
      )}
    </div>
  );
};

export default ControleRubricaPage;
