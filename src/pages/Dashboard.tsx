import { useState, useCallback, useEffect, useMemo, useRef, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import KpiCard from "@/components/KpiCard";
import { motion, LayoutGroup } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowDownAZ, Check, GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const MOCK_GOALS = [
  { id: "1", name: "Taxa de ocupação de leitos", target: 85, current: 78, unit: "%", type: "QNT" as const, risk: 12400, trend: "down" as const },
  { id: "2", name: "Tempo médio de espera (emergência)", target: 30, current: 42, unit: "min", type: "QNT" as const, risk: 8200, trend: "up" as const },
  { id: "3", name: "Satisfação do paciente (NPS)", target: 75, current: 71, unit: "pts", type: "QNT" as const, risk: 5600, trend: "stable" as const },
  { id: "4", name: "Protocolo de higienização", target: 100, current: 92, unit: "%", type: "QLT" as const, risk: 3100, trend: "up" as const },
  { id: "5", name: "Relatório quadrimestral (RDQA)", target: 1, current: 0, unit: "doc", type: "DOC" as const, risk: 15000, trend: "down" as const },
  { id: "6", name: "Taxa de infecção hospitalar", target: 5, current: 6.2, unit: "%", type: "QNT" as const, risk: 9800, trend: "down" as const },
  { id: "7", name: "Cirurgias eletivas realizadas", target: 120, current: 98, unit: "un", type: "QNT" as const, risk: 7300, trend: "up" as const },
  { id: "8", name: "Comissão de óbitos ativa", target: 1, current: 1, unit: "doc", type: "QLT" as const, risk: 0, trend: "stable" as const },
];

const FINANCIAL_CARD_IDS = ["contratos", "controle-rubrica"];

const ALL_NAV_CARDS = [
  { id: "contratos", title: "Contratos", description: "Gerir contratos, valores e glosas", route: "/contratos" },
  { id: "metas", title: "Metas e indicadores", description: "Detalhamento e projeções por meta", route: "/metas" },
  { id: "evidencias", title: "Plano de Ação", description: "Análise crítica, ações corretivas e evidências", route: "/evidencias" },
  { id: "relatorios", title: "Relatórios", description: "Gerar PDF consolidado por período", route: "/relatorios" },
  { id: "admin", title: "Administração", description: "Usuários, perfis e permissões", route: "/admin" },
  { id: "lancamento", title: "Lançamentos", description: "Lançamento de metas e rubricas", route: "/lancamento" },
  { id: "sau", title: "SAU", description: "Serviço de Atendimento ao Usuário", route: "/sau" },
  { id: "relatorio-assistencial", title: "Relatório Assistencial", description: "Indicadores e dados assistenciais", route: "/relatorio-assistencial" },
  { id: "controle-rubrica", title: "Controle de Rubrica", description: "Gestão e acompanhamento de rubricas", route: "/controle-rubrica" },
];

const ORDER_STORAGE_KEY = "dashboard-card-order";

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isOrganizeMode, setIsOrganizeMode] = useState(false);

  const allowedCards = profile?.allowed_cards;

  const baseCards = useMemo(() => {
    const scoped = allowedCards && allowedCards.length > 0
      ? ALL_NAV_CARDS.filter((card) => allowedCards.includes(card.id))
      : ALL_NAV_CARDS;

    return isAdmin
      ? scoped
      : scoped.filter((card) => !FINANCIAL_CARD_IDS.includes(card.id));
  }, [allowedCards, isAdmin]);

  const defaultOrder = useMemo(() => baseCards.map((card) => card.id), [baseCards]);
  const [cardOrder, setCardOrder] = useState<string[]>(defaultOrder);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ORDER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        const validIds = new Set(defaultOrder);
        const ordered = parsed.filter((id) => validIds.has(id));
        const missing = defaultOrder.filter((id) => !ordered.includes(id));
        setCardOrder([...ordered, ...missing]);
        return;
      }
    } catch {
      // no-op
    }

    setCardOrder(defaultOrder);
  }, [defaultOrder]);

  const orderedCards = useMemo(() => {
    const ordered = cardOrder
      .map((id) => baseCards.find((card) => card.id === id))
      .filter(Boolean) as typeof baseCards;

    const missing = baseCards.filter((card) => !cardOrder.includes(card.id));
    return [...ordered, ...missing];
  }, [cardOrder, baseCards]);

  const saveOrder = useCallback((ids: string[]) => {
    setCardOrder(ids);
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(ids));
  }, []);

  const resetDragState = useCallback(() => {
    setDraggingIndex(null);
    setDragOverIndex(null);
    dragItem.current = null;
    dragOverItem.current = null;
  }, []);

  const handleDragStart = useCallback((event: DragEvent<HTMLDivElement>, index: number) => {
    if (!isOrganizeMode) return;

    dragItem.current = index;
    setDraggingIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", orderedCards[index]?.id ?? "");
  }, [isOrganizeMode, orderedCards]);

  const handleDragEnter = useCallback((index: number) => {
    if (!isOrganizeMode || dragItem.current === null || dragItem.current === index) return;

    dragOverItem.current = index;
    setDragOverIndex(index);
  }, [isOrganizeMode]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!isOrganizeMode) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, [isOrganizeMode]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (
      !isOrganizeMode ||
      dragItem.current === null ||
      dragOverItem.current === null ||
      dragItem.current === dragOverItem.current
    ) {
      resetDragState();
      return;
    }

    const nextOrder = orderedCards.map((card) => card.id);
    const draggedId = nextOrder[dragItem.current];

    nextOrder.splice(dragItem.current, 1);
    nextOrder.splice(dragOverItem.current, 0, draggedId);

    saveOrder(nextOrder);
    resetDragState();
  }, [isOrganizeMode, orderedCards, resetDragState, saveOrder]);

  const handleDragEnd = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  const toggleOrganizeMode = useCallback(() => {
    setIsOrganizeMode((prev) => !prev);
    resetDragState();
  }, [resetDragState]);

  const autoOrganize = useCallback(() => {
    const sorted = [...baseCards]
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
      .map((card) => card.id);

    saveOrder(sorted);
    resetDragState();
  }, [baseCards, resetDragState, saveOrder]);

  const resetLayout = useCallback(() => {
    saveOrder(defaultOrder);
    resetDragState();
  }, [defaultOrder, resetDragState, saveOrder]);

  const totalRisk = MOCK_GOALS.reduce((sum, goal) => sum + goal.risk, 0);
  const goalsAtRisk = MOCK_GOALS.filter((goal) => goal.risk > 0).length;
  const avgAttainment = Math.round(
    MOCK_GOALS.reduce((sum, goal) => {
      const attainment = goal.type === "DOC"
        ? (goal.current >= goal.target ? 100 : 0)
        : Math.min(100, (goal.current / goal.target) * 100);

      return sum + attainment;
    }, 0) / MOCK_GOALS.length
  );
  const pendingEvidence = MOCK_GOALS.filter((goal) => goal.type === "DOC" && goal.current < goal.target).length;

  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {isAdmin && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} onClick={() => navigate("/contratos")} className="cursor-pointer">
              <KpiCard label="R$ em risco" value={`R$ ${(totalRisk / 1000).toFixed(1)}k`} status="critical" subtitle="Contrato vigente" />
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} onClick={() => navigate("/metas")} className="cursor-pointer">
            <KpiCard label="Metas em risco" value={`${goalsAtRisk} de ${MOCK_GOALS.length}`} status="warning" subtitle="Abaixo do pactuado" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} onClick={() => navigate("/relatorios")} className="cursor-pointer">
            <KpiCard label="Atingimento médio" value={`${avgAttainment}%`} status={avgAttainment >= 90 ? "success" : avgAttainment >= 70 ? "warning" : "critical"} subtitle="Todas as metas" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} onClick={() => navigate("/evidencias")} className="cursor-pointer">
            <KpiCard label="Planos de ação pendentes" value={String(pendingEvidence)} status={pendingEvidence > 0 ? "warning" : "success"} subtitle="Ações a tratar" />
          </motion.div>
        </div>

        <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {isOrganizeMode
              ? "Modo organização ativo: arraste um card e solte sobre outro para trocar de posição."
              : "Clique em Organizar cards para ativar o arraste sem misturar com a navegação."}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant={isOrganizeMode ? "default" : "outline"} size="sm" onClick={toggleOrganizeMode} className="gap-2 text-xs">
              {isOrganizeMode ? <Check className="h-4 w-4" /> : <GripVertical className="h-4 w-4" />}
              {isOrganizeMode ? "Concluir organização" : "Organizar cards"}
            </Button>
            <Button variant="outline" size="sm" onClick={resetLayout} className="gap-2 text-xs">
              <RotateCcw className="h-4 w-4" />
              Resetar padrão
            </Button>
            <Button variant="outline" size="sm" onClick={autoOrganize} className="gap-2 text-xs">
              <ArrowDownAZ className="h-4 w-4" />
              Auto Organizar
            </Button>
          </div>
        </div>

        <LayoutGroup>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {orderedCards.map((card, index) => (
              <motion.div
                key={card.id}
                layout
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                draggable={isOrganizeMode}
                onDragStart={(event) => handleDragStart(event, index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                className={`transition-all duration-150 ${
                  isOrganizeMode ? "cursor-grab active:cursor-grabbing" : ""
                } ${
                  draggingIndex === index ? "opacity-45 scale-[0.98]" : ""
                } ${
                  dragOverIndex === index && draggingIndex !== index
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : ""
                }`}
              >
                <NavCard
                  title={card.title}
                  description={card.description}
                  onClick={() => navigate(card.route)}
                  isOrganizeMode={isOrganizeMode}
                />
              </motion.div>
            ))}
          </div>
        </LayoutGroup>
      </main>
    </div>
  );
};

interface NavCardProps {
  title: string;
  description: string;
  onClick: () => void;
  isOrganizeMode: boolean;
}

const NavCard = ({ title, description, onClick, isOrganizeMode }: NavCardProps) => (
  <div
    onClick={() => {
      if (!isOrganizeMode) onClick();
    }}
    className={`kpi-card group w-full select-none text-left transition-all ${
      isOrganizeMode ? "border-primary/20" : "cursor-pointer"
    }`}
  >
    <div className="flex items-start gap-3">
      <div className={`shrink-0 rounded-full p-1 ${isOrganizeMode ? "bg-muted text-foreground" : "text-muted-foreground/40"}`}>
        <GripVertical className={`h-4 w-4 ${isOrganizeMode ? "opacity-100" : "opacity-50 group-hover:opacity-80"}`} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">{title}</h3>
          {isOrganizeMode && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Arraste</span>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  </div>
);

export default Dashboard;
