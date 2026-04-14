import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 };

interface Props {
  autoDataKey: string;
  selectedContract: any;
  unit: string;
  period: string;
  goalsBySector: Record<string, any[]>;
  goalSummary: any;
  actionPlanSummary: any;
  sauSummary: any;
  bedSummary: any;
  rubricaSummary: any;
}

const AutoDataPanel = ({
  autoDataKey, selectedContract, unit, period,
  goalsBySector, goalSummary, actionPlanSummary, sauSummary, bedSummary, rubricaSummary,
}: Props) => {
  switch (autoDataKey) {
    case "contract":
      if (!selectedContract) return null;
      return (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-primary">Dados compilados do contrato</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Contrato", value: selectedContract.name },
              { label: "Unidade", value: unit },
              { label: "Valor mensal", value: `R$ ${Number(selectedContract.value).toLocaleString("pt-BR")}` },
              { label: "Status", value: selectedContract.status },
              { label: "Vigência", value: selectedContract.period },
              { label: "Variável", value: `${(Number(selectedContract.variable) * 100).toFixed(0)}%` },
              { label: "Metas vinculadas", value: selectedContract.goals },
            ].map((item, i) => (
              <div key={i} className="bg-card rounded-lg p-3 border border-border">
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
                <p className="text-sm font-bold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "goals":
      if (goalSummary.total === 0) return <p className="text-xs text-muted-foreground italic">Nenhuma meta cadastrada para esta unidade no período.</p>;
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">Produção Assistencial — {period}</span>
            <Badge variant="secondary" className="text-[10px]">{goalSummary.total} metas</Badge>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Atingimento médio", value: `${goalSummary.avg}%`, color: goalSummary.avg >= 90 ? "text-emerald-600" : goalSummary.avg >= 60 ? "text-amber-500" : "text-foreground" },
              { label: "Metas atingidas", value: goalSummary.atingidas, color: "text-emerald-600" },
              { label: "Em evolução", value: goalSummary.parciais, color: "text-amber-500" },
              { label: "A desenvolver", value: goalSummary.criticas, color: "text-foreground" },
              { label: "Total de metas", value: goalSummary.total, color: "text-foreground" },
            ].map((kpi, i) => (
              <div key={i} className="bg-card rounded-lg p-3 border border-border text-center">
                <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>
          {Object.entries(goalsBySector).map(([sector, goals]) => {
            const sectorGoals = [...goals].sort((a: any, b: any) => b.pct - a.pct);
            const sectorAvg = Math.round(sectorGoals.reduce((s: number, g: any) => s + g.pct, 0) / sectorGoals.length);
            const chartData = sectorGoals.map((g: any) => ({ name: g.name.length > 25 ? g.name.slice(0, 25) + "…" : g.name, pct: g.pct }));
            return (
              <div key={sector} className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-foreground">{sector}</span>
                  <Badge variant="outline" className="text-[10px]">{goals.length} metas</Badge>
                  <Badge className="text-[10px]" variant="secondary">{sectorAvg}% médio</Badge>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(150, sectorGoals.length * 28)}>
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" domain={[0, 110]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: number) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="pct" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 9, formatter: (v: number) => `${v}%` }}>
                      {sectorGoals.map((g: any, i: number) => (
                        <Cell key={i} fill={g.pct >= 90 ? "hsl(142 71% 45%)" : g.pct >= 60 ? "hsl(38 92% 50%)" : "hsl(var(--muted-foreground))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      );

    case "goals_trend":
      if (goalSummary.total === 0) return <p className="text-xs text-muted-foreground italic">Nenhum indicador de acompanhamento disponível.</p>;
      return (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-primary">Indicadores de Acompanhamento — {period}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Metas atingidas", value: `${goalSummary.atingidas}/${goalSummary.total}` },
              { label: "Atingimento médio", value: `${goalSummary.avg}%` },
              { label: "Em desenvolvimento", value: goalSummary.criticas },
              { label: "Desempenho geral", value: goalSummary.avg >= 90 ? "Satisfatório" : goalSummary.avg >= 60 ? "Parcial" : "Em evolução" },
            ].map((kpi, i) => (
              <div key={i} className="bg-card rounded-lg p-3 border border-border text-center">
                <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                <p className="text-sm font-bold text-foreground">{kpi.value}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "actionPlans":
      if (actionPlanSummary.total === 0) return <p className="text-xs text-muted-foreground italic">Nenhum plano de ação registrado.</p>;
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">Tratativas e Planos de Ação</span>
            <Badge variant="secondary" className="text-[10px]">{actionPlanSummary.total} tratativas</Badge>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Total", value: actionPlanSummary.total, color: "text-foreground" },
              { label: "Concluídas", value: actionPlanSummary.concluidas, color: "text-emerald-600" },
              { label: "Em andamento", value: actionPlanSummary.emAndamento, color: "text-amber-500" },
              { label: "Não iniciadas", value: actionPlanSummary.naoIniciadas, color: "text-foreground" },
              { label: "Efetividade", value: actionPlanSummary.total > 0 ? `${Math.round((actionPlanSummary.concluidas / actionPlanSummary.total) * 100)}%` : "—", color: "text-emerald-600" },
            ].map((kpi, i) => (
              <div key={i} className="bg-card rounded-lg p-3 border border-border text-center">
                <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Evolução das Tratativas</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={[
                    { name: "Concluídas", value: actionPlanSummary.concluidas },
                    { name: "Em andamento", value: actionPlanSummary.emAndamento },
                    { name: "Não iniciadas", value: actionPlanSummary.naoIniciadas },
                  ].filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3} label={({ name, value }) => `${value}`}>
                    {[
                      "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(var(--muted-foreground))",
                    ].filter((_, i) => [actionPlanSummary.concluidas, actionPlanSummary.emAndamento, actionPlanSummary.naoIniciadas][i] > 0).map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Classificação por Prioridade</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={[
                  { name: "Alta", value: actionPlanSummary.byPriority.critica + actionPlanSummary.byPriority.alta },
                  { name: "Média", value: actionPlanSummary.byPriority.media },
                  { name: "Baixa", value: actionPlanSummary.byPriority.baixa },
                ].filter(d => d.value > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" label={{ position: "top", fontSize: 10 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Tratativas registradas</p>
            <div className="overflow-auto max-h-48">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1 px-2">Referência</th>
                  <th className="text-left py-1 px-2">Prioridade</th>
                  <th className="text-left py-1 px-2">Status</th>
                  <th className="text-left py-1 px-2">Responsável</th>
                  <th className="text-left py-1 px-2">Prazo</th>
                </tr></thead>
                <tbody>
                  {actionPlanSummary.plans.slice(0, 10).map((p: any) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-1 px-2 truncate max-w-[180px]">{p.reference_name}</td>
                      <td className="py-1 px-2">{p.prioridade}</td>
                      <td className="py-1 px-2">{p.status_acao === "concluida" ? "Concluída" : p.status_acao === "em_andamento" ? "Em andamento" : p.status_acao === "nao_iniciada" ? "Não iniciada" : "Cancelada"}</td>
                      <td className="py-1 px-2">{p.responsavel || "—"}</td>
                      <td className="py-1 px-2">{p.prazo || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );

    case "sau":
      if (sauSummary.total === 0) return <p className="text-xs text-muted-foreground italic">Nenhum registro SAU.</p>;
      return (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-primary">SAU — Serviço de Atendimento ao Usuário</p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Total de registros", value: sauSummary.total, color: "text-foreground" },
              { label: "Elogios", value: sauSummary.elogios, color: "text-emerald-600" },
              { label: "Reclamações", value: sauSummary.reclamacoes, color: "text-foreground" },
              { label: "Sugestões", value: sauSummary.sugestoes, color: "text-amber-500" },
              { label: "Resolvidos", value: sauSummary.resolvidos, color: "text-emerald-600" },
            ].map((kpi, i) => (
              <div key={i} className="bg-card rounded-lg p-3 border border-border text-center">
                <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[
                { name: "Elogios", value: sauSummary.elogios },
                { name: "Reclamações", value: sauSummary.reclamacoes },
                { name: "Sugestões", value: sauSummary.sugestoes },
                { name: "Ouvidoria", value: sauSummary.ouvidoria },
              ].filter(d => d.value > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" label={{ position: "top", fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    case "beds":
      if (bedSummary.total === 0) return <p className="text-xs text-muted-foreground italic">Nenhum leito cadastrado.</p>;
      return (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-primary">Capacidade Instalada e Movimentação Assistencial — {unit}</p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Total de leitos", value: bedSummary.total },
              { label: "Internação", value: bedSummary.totalInternacao },
              { label: "Complementar", value: bedSummary.totalComplementar },
              { label: "Internações (mês)", value: bedSummary.movements.totalAdmissions },
              { label: "Altas (mês)", value: bedSummary.movements.totalDischarges },
            ].map((kpi, i) => (
              <div key={i} className="bg-card rounded-lg p-3 border border-border text-center">
                <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-bold text-foreground">{kpi.value}</p>
              </div>
            ))}
          </div>
          {bedSummary.movements.count > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Óbitos", value: bedSummary.movements.totalDeaths },
                { label: "Transferências", value: bedSummary.movements.totalTransfers },
                { label: "Dias com registro", value: bedSummary.movements.count },
              ].map((kpi, i) => (
                <div key={i} className="bg-card rounded-lg p-3 border border-border text-center">
                  <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-bold text-foreground">{kpi.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case "rubricas":
      if (rubricaSummary.totalExecuted === 0) return <p className="text-xs text-muted-foreground italic">Nenhuma execução financeira registrada no período.</p>;
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">Execução Financeira — {period}</span>
            <Badge variant="secondary" className="text-[10px]">R$ {rubricaSummary.totalExecuted.toLocaleString("pt-BR")}</Badge>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <ResponsiveContainer width="100%" height={Math.max(150, Object.keys(rubricaSummary.byRubrica).length * 28)}>
              <BarChart data={Object.entries(rubricaSummary.byRubrica).map(([name, value]) => ({
                name: name.length > 25 ? name.slice(0, 25) + "…" : name,
                value,
              }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 9, formatter: (v: number) => `R$ ${(v / 1000).toFixed(1)}k` }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    default:
      return null;
  }
};

export default AutoDataPanel;
