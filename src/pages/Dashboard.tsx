import { useState, useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import KpiCard from "@/components/KpiCard";
import { motion, LayoutGroup } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowDownAZ, GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_ONLY_CARD_IDS = ["contratos", "controle-rubrica", "admin", "relatorios", "relatorio-assistencial"];

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

interface DashboardKpis {
  totalRisk: number;
  goalsAtRisk: number;
  totalGoals: number;
  avgAttainment: number;
  pendingActions: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, isAdmin, role } = useAuth();
  const dragRef = useRef<ActiveDrag | null>(null);
  const didDrag = useRef(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [cardOffsets, setCardOffsets] = useState<Record<string, CardOffset>>({});
  const [kpis, setKpis] = useState<DashboardKpis>({ totalRisk: 0, goalsAtRisk: 0, totalGoals: 0, avgAttainment: 0, pendingActions: 0 });

  const allowedCards = profile?.allowed_cards;
  const hasFinancialAccess = isAdmin || role === "gestor";

  // Fetch real KPIs from DB
  useEffect(() => {
    const fetchKpis = async () => {
      // Goals + entries
      const { data: goalsData } = await supabase.from("goals").select("id, target, type, weight, risk");
      const { data: entriesData } = await supabase.from("goal_entries").select("goal_id, value");
      
      const entriesByGoal: Record<string, number> = {};
      (entriesData || []).forEach(e => {
        entriesByGoal[e.goal_id] = (entriesByGoal[e.goal_id] || 0) + Number(e.value);
      });

      const goals = goalsData || [];
      let totalRisk = 0;
      let goalsAtRisk = 0;
      let sumAttainment = 0;

      goals.forEach(g => {
        const current = entriesByGoal[g.id] || 0;
        const target = Number(g.target);
        const attainment = g.type === "DOC"
          ? (current >= target ? 100 : 0)
          : target > 0 ? Math.min(100, (current / target) * 100) : 0;
        
        const risk = Number(g.risk) || 0;
        if (attainment < 100 && risk > 0) {
          totalRisk += risk;
          goalsAtRisk++;
        }
        sumAttainment += attainment;
      });

      const avgAttainment = goals.length > 0 ? Math.round(sumAttainment / goals.length) : 0;

      // Action plans pending
      const { count: pendingActions } = await supabase
        .from("action_plans")
        .select("id", { count: "exact", head: true })
        .in("status_acao", ["nao_iniciada", "em_andamento"]);

      setKpis({
        totalRisk,
        goalsAtRisk,
        totalGoals: goals.length,
        avgAttainment,
        pendingActions: pendingActions || 0,
      });
    };
    fetchKpis();
  }, []);

  const baseCards = useMemo(() => {
    if (isAdmin) return ALL_NAV_CARDS;
    if (allowedCards && allowedCards.length > 0) {
      let cards = ALL_NAV_CARDS.filter((card) => allowedCards.includes(card.id));
      if (hasFinancialAccess) {
        const financialIds = ADMIN_ONLY_CARD_IDS.filter(id => id !== "admin");
        financialIds.forEach(id => {
          if (!cards.find(c => c.id === id)) {
            const card = ALL_NAV_CARDS.find(c => c.id === id);
            if (card) cards.push(card);
          }
        });
      }
      return cards;
    }
    if (hasFinancialAccess) {
      return ALL_NAV_CARDS.filter((card) => card.id !== "admin");
    }
    return ALL_NAV_CARDS.filter((card) => !ADMIN_ONLY_CARD_IDS.includes(card.id));
  }, [allowedCards, isAdmin, hasFinancialAccess]);

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
    } catch { /* no-op */ }
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
    } catch { /* no-op */ }
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
    dragRef.current = { cardId, startX: event.clientX, startY: event.clientY, baseX: currentOffset.x, baseY: currentOffset.y };
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
    updateCardOffset(cardId, { x: dragRef.current.baseX + deltaX, y: dragRef.current.baseY + deltaY });
  }, [updateCardOffset]);

  const finishDrag = useCallback(() => {
    dragRef.current = null;
    setActiveCardId(null);
  }, []);

  const handleCardClick = useCallback((route: string) => {
    if (!didDrag.current) navigate(route);
  }, [navigate]);

  const autoOrganize = useCallback(() => {
    const sorted = [...baseCards].sort((a, b) => a.title.localeCompare(b.title, "pt-BR")).map((card) => card.id);
    saveOrder(sorted);
    clearCardOffsets();
  }, [baseCards, clearCardOffsets, saveOrder]);

  const resetLayout = useCallback(() => {
    saveOrder(defaultOrder);
    clearCardOffsets();
  }, [clearCardOffsets, defaultOrder, saveOrder]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {isAdmin && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} onClick={() => navigate("/contratos")} className="cursor-pointer">
              <KpiCard label="R$ em risco" value={`R$ ${(kpis.totalRisk / 1000).toFixed(1)}k`} status="critical" subtitle="Contrato vigente" />
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} onClick={() => navigate("/metas")} className="cursor-pointer">
            <KpiCard label="Metas em risco" value={`${kpis.goalsAtRisk} de ${kpis.totalGoals}`} status="warning" subtitle="Abaixo do pactuado" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} onClick={() => navigate("/relatorios")} className="cursor-pointer">
            <KpiCard label="Atingimento médio" value={`${kpis.avgAttainment}%`} status={kpis.avgAttainment >= 90 ? "success" : kpis.avgAttainment >= 70 ? "warning" : "critical"} subtitle="Todas as metas" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} onClick={() => navigate("/evidencias")} className="cursor-pointer">
            <KpiCard label="Planos de ação pendentes" value={String(kpis.pendingActions)} status={kpis.pendingActions > 0 ? "warning" : "success"} subtitle="Ações a tratar" />
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
