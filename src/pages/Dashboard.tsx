import { useState, useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import KpiCard from "@/components/KpiCard";
import { motion, LayoutGroup } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowDownAZ, GripVertical, RotateCcw } from "lucide-react";
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

const ADMIN_ONLY_CARD_IDS = ["contratos", "controle-rubrica", "admin", "relatorios", "risco"];

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

type CardOffset = { x: number; y: number };
type ActiveDrag = {
  cardId: string;
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
};

const ORDER_STORAGE_KEY = "dashboard-card-order";
const POSITION_STORAGE_KEY = "dashboard-card-positions";
const DRAG_THRESHOLD = 6;

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const dragRef = useRef<ActiveDrag | null>(null);
  const didDrag = useRef(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [cardOffsets, setCardOffsets] = useState<Record<string, CardOffset>>({});

  const allowedCards = profile?.allowed_cards;

  const baseCards = useMemo(() => {
    const scoped = allowedCards && allowedCards.length > 0
      ? ALL_NAV_CARDS.filter((card) => allowedCards.includes(card.id))
      : ALL_NAV_CARDS;

    return isAdmin ? scoped : scoped.filter((card) => !ADMIN_ONLY_CARD_IDS.includes(card.id));
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, CardOffset>;
        const validIds = new Set(defaultOrder);
        const filtered = Object.fromEntries(
          Object.entries(parsed).filter(([id]) => validIds.has(id))
        ) as Record<string, CardOffset>;
        setCardOffsets(filtered);
        return;
      }
    } catch {
      // no-op
    }

    setCardOffsets({});
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

  const updateCardOffset = useCallback((cardId: string, nextOffset: CardOffset) => {
    setCardOffsets((prev) => {
      const next = { ...prev, [cardId]: nextOffset };
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearCardOffsets = useCallback(() => {
    setCardOffsets({});
    localStorage.removeItem(POSITION_STORAGE_KEY);
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>, cardId: string) => {
    if (event.button !== 0) return;

    const currentOffset = cardOffsets[cardId] ?? { x: 0, y: 0 };
    dragRef.current = {
      cardId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: currentOffset.x,
      baseY: currentOffset.y,
    };
    didDrag.current = false;
    setActiveCardId(cardId);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [cardOffsets]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>, cardId: string) => {
    if (!dragRef.current || dragRef.current.cardId !== cardId) return;

    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;

    if (!didDrag.current && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
      didDrag.current = true;
    }

    updateCardOffset(cardId, {
      x: dragRef.current.baseX + deltaX,
      y: dragRef.current.baseY + deltaY,
    });
  }, [updateCardOffset]);

  const finishDrag = useCallback(() => {
    dragRef.current = null;
    setActiveCardId(null);
  }, []);

  const handleCardClick = useCallback((route: string) => {
    if (!didDrag.current) {
      navigate(route);
    }
  }, [navigate]);

  const autoOrganize = useCallback(() => {
    const sorted = [...baseCards]
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
      .map((card) => card.id);

    saveOrder(sorted);
    clearCardOffsets();
  }, [baseCards, clearCardOffsets, saveOrder]);

  const resetLayout = useCallback(() => {
    saveOrder(defaultOrder);
    clearCardOffsets();
  }, [clearCardOffsets, defaultOrder, saveOrder]);

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

        <div className="flex justify-end gap-1.5 mb-3">
          <Button variant="ghost" size="icon" onClick={resetLayout} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Resetar padrão">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={autoOrganize} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Auto Organizar">
            <ArrowDownAZ className="h-3.5 w-3.5" />
          </Button>
        </div>

        <LayoutGroup>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {orderedCards.map((card) => {
              const offset = cardOffsets[card.id] ?? { x: 0, y: 0 };
              const isDragging = activeCardId === card.id;

              return (
                <motion.div key={card.id} layout transition={{ type: "spring", stiffness: 400, damping: 32 }}>
                  <div
                    onPointerDown={(event) => handlePointerDown(event, card.id)}
                    onPointerMove={(event) => handlePointerMove(event, card.id)}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    onClick={() => handleCardClick(card.route)}
                    className={`touch-none select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                    style={{
                      transform: `translate(${offset.x}px, ${offset.y}px)`,
                      transition: isDragging ? "none" : "transform 160ms ease",
                      position: "relative",
                      zIndex: isDragging ? 30 : 1,
                    }}
                  >
                    <NavCard title={card.title} description={card.description} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </LayoutGroup>
      </main>
    </div>
  );
};

interface NavCardProps {
  title: string;
  description: string;
}

const NavCard = ({ title, description }: NavCardProps) => (
  <div className="kpi-card group w-full cursor-pointer text-left">
    <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
  </div>
);

export default Dashboard;
