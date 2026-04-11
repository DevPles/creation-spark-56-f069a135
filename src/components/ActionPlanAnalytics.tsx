import { Tables } from "@/integrations/supabase/types";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

type ActionPlan = Tables<"action_plans">;

interface Props {
  plans: ActionPlan[];
  selectedUnit: string;
}

const TIPO_LABELS: Record<string, string> = {
  processo: "Processo",
  equipamento: "Equipamento",
  rh: "RH",
  insumo: "Insumo",
  infraestrutura: "Infraestrutura",
  outro: "Outro",
};

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--accent))", "hsl(var(--muted))", "hsl(var(--secondary))"];

const ActionPlanAnalytics = ({ plans, selectedUnit }: Props) => {
  const filtered = selectedUnit === "Todas as unidades" ? plans : plans.filter(p => p.facility_unit === selectedUnit);

  const byTipo = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(p => {
      const key = p.tipo_problema || "outro";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([key, value]) => ({
      name: TIPO_LABELS[key] || key,
      value,
    }));
  }, [filtered]);

  const byArea = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(p => {
      const key = p.area || "Sem área";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered]);

  const byUnit = useMemo(() => {
    const counts: Record<string, number> = {};
    plans.forEach(p => {
      counts[p.facility_unit] = (counts[p.facility_unit] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [plans]);

  const reincidencia = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(p => {
      counts[p.reference_name] = (counts[p.reference_name] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 1)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  const byPrioridade = useMemo(() => {
    const labels: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };
    const counts: Record<string, number> = {};
    filtered.forEach(p => {
      const key = p.prioridade || "media";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([key, value]) => ({ name: labels[key] || key, value }));
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Nenhum dado para análise. Crie planos de ação para visualizar os gráficos.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* By tipo problema */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold mb-3">Incidência por Tipo de Problema</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={byTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
              {byTipo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* By area */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold mb-3">Incidência por Área / Setor</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byArea} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By unit */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold mb-3">Distribuição por Unidade</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byUnit}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Prioridade */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold mb-3">Distribuição por Prioridade</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={byPrioridade} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {byPrioridade.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Reincidência */}
      {reincidencia.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4 md:col-span-2">
          <h3 className="text-sm font-semibold mb-3">Ranking de Reincidência</h3>
          <p className="text-xs text-muted-foreground mb-3">Metas/rubricas com múltiplos planos de ação registrados</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={reincidencia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default ActionPlanAnalytics;
