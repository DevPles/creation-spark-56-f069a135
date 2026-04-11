import { Tables } from "@/integrations/supabase/types";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3 } from "lucide-react";

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

const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-card rounded-xl border border-border p-5">
    <h3 className="text-sm font-semibold font-display mb-4">{title}</h3>
    {children}
  </div>
);

const ActionPlanAnalytics = ({ plans, selectedUnit }: Props) => {
  const filtered = selectedUnit === "Todas as unidades" ? plans : plans.filter(p => p.facility_unit === selectedUnit);

  const byTipo = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(p => {
      const key = p.tipo_problema || "outro";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([key, value]) => ({
      name: TIPO_LABELS[key] || key, value,
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
      <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
        <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
        Nenhum dado para análise. Crie planos de ação para visualizar os gráficos.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ChartCard title="Incidência por Tipo de Problema">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={byTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, value }) => `${name}: ${value}`}>
              {byTipo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Incidência por Área / Setor">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byArea} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Distribuição por Unidade">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byUnit}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Distribuição por Prioridade">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={byPrioridade} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
              {byPrioridade.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {reincidencia.length > 0 && (
        <ChartCard title="Ranking de Reincidência">
          <p className="text-xs text-muted-foreground mb-3 -mt-2">Metas/rubricas com múltiplos planos de ação</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={reincidencia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
};

export default ActionPlanAnalytics;
