import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";

type ActionPlan = Tables<"action_plans">;

interface ActionPlanTableProps {
  plans: ActionPlan[];
  onSelect: (plan: ActionPlan) => void;
}

const STATUS_ACAO_MAP: Record<string, { label: string; className: string }> = {
  nao_iniciada: { label: "Não iniciada", className: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em andamento", className: "bg-accent text-accent-foreground" },
  concluida: { label: "Concluída", className: "status-success" },
  cancelada: { label: "Cancelada", className: "status-critical" },
};

const STATUS_EVIDENCIA_MAP: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "status-warning" },
  enviada: { label: "Enviada", className: "bg-accent text-accent-foreground" },
  validada: { label: "Validada", className: "status-success" },
  rejeitada: { label: "Rejeitada", className: "status-critical" },
};

const PRIORIDADE_MAP: Record<string, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "bg-muted text-muted-foreground" },
  media: { label: "Média", className: "bg-accent text-accent-foreground" },
  alta: { label: "Alta", className: "status-warning" },
  critica: { label: "Crítica", className: "status-critical" },
};

const TIPO_PROBLEMA_MAP: Record<string, string> = {
  processo: "Processo",
  equipamento: "Equipamento",
  rh: "RH",
  insumo: "Insumo",
  infraestrutura: "Infraestrutura",
  outro: "Outro",
};

const ActionPlanTable = ({ plans, onSelect }: ActionPlanTableProps) => {
  return (
    <div className="space-y-3">

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-border grid grid-cols-12 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="col-span-3">Referência</span>
          <span className="col-span-2">Tipo / Área</span>
          <span className="col-span-2">Responsável</span>
          <span className="col-span-1">Prazo</span>
          <span className="col-span-1">Prioridade</span>
          <span className="col-span-1">Ação</span>
          <span className="col-span-2">Evidência</span>
        </div>
        {plans.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum plano de ação encontrado
          </div>
        )}
        {plans.map((plan, i) => {
          const statusAcao = STATUS_ACAO_MAP[plan.status_acao] || STATUS_ACAO_MAP.nao_iniciada;
          const statusEv = STATUS_EVIDENCIA_MAP[plan.status_evidencia] || STATUS_EVIDENCIA_MAP.pendente;
          const prioridade = PRIORIDADE_MAP[plan.prioridade] || PRIORIDADE_MAP.media;
          const isCritica = plan.prioridade === "critica" || plan.prioridade === "alta";

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => onSelect(plan)}
              className={`px-4 py-3 grid grid-cols-12 items-center text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${isCritica ? "bg-destructive/5" : ""}`}
            >
              <span className="col-span-3 font-medium text-foreground truncate flex items-center gap-1.5">
                {isCritica && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                {plan.reference_name}
              </span>
              <span className="col-span-2 text-muted-foreground truncate text-xs">
                {TIPO_PROBLEMA_MAP[plan.tipo_problema] || "—"}
                {plan.area && <span className="block text-[10px] text-muted-foreground/70">{plan.area}</span>}
              </span>
              <span className="col-span-2 text-muted-foreground truncate text-xs">{plan.responsavel || "—"}</span>
              <span className="col-span-1 text-muted-foreground text-xs">
                {plan.prazo ? new Date(plan.prazo + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
              </span>
              <span className="col-span-1">
                <Badge variant="outline" className={`text-[10px] ${prioridade.className}`}>{prioridade.label}</Badge>
              </span>
              <span className="col-span-1">
                <Badge variant="outline" className={`text-[10px] ${statusAcao.className}`}>{statusAcao.label}</Badge>
              </span>
              <span className="col-span-2">
                <Badge variant="outline" className={`text-[10px] ${statusEv.className}`}>{statusEv.label}</Badge>
              </span>
            </motion.div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-right">
        {plans.length} planos
      </p>
    </div>
  );
};

export default ActionPlanTable;
