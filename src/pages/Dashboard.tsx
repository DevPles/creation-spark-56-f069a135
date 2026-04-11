import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import KpiCard from "@/components/KpiCard";
import { motion, type PanInfo } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowDownAZ, RotateCcw } from "lucide-react";
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

type CardPosition = { x: number; y: number };
type NavCardItem = (typeof ALL_NAV_CARDS)[number];

const ORDER_STORAGE_KEY = "dashboard-card-order";
const POSITION_STORAGE_KEY = "dashboard-card-positions";
const CARD_HEIGHT = 100;
const CARD_GAP = 24;

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);

  const allowedCards = profile?.allowed_cards;

  const baseCards = useMemo(() => {
    const scopedCards = allowedCards && allowedCards.length > 0
      ? ALL_NAV_CARDS.filter((card) => allowedCards.includes(card.id))
      : ALL_NAV_CARDS;
    return isAdmin ? scopedCards : scopedCards.filter((card) => !FINANCIAL_CARD_IDS.includes(card.id));
  }, [allowedCards, isAdmin]);

  const defaultOrder = useMemo(() => baseCards.map((card) => card.id), [baseCards]);

  const [cardOrder, setCardOrder] = useState<string[]>(defaultOrder);
  const [customPositions, setCustomPositions] = useState<Record<string, CardPosition>>({});
  const [containerWidth, setContainerWidth] = useState(960);
  const [layoutVersion, setLayoutVersion] = useState(0);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.clientWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const validIds = new Set(defaultOrder);
    let nextOrder = defaultOrder;
    try {
      const saved = localStorage.getItem(ORDER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        const ordered = parsed.filter((id) => validIds.has(id));
        const missing = defaultOrder.filter((id) => !ordered.includes(id));
        nextOrder = [...ordered, ...missing];
      }
    } catch { /* */ }
    setCardOrder(nextOrder);

    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, CardPosition>;
        setCustomPositions(Object.fromEntries(Object.entries(parsed).filter(([id]) => validIds.has(id))));
      }
    } catch { /* */ }
  }, [defaultOrder]);

  const saveOrder = useCallback((ids: string[]) => {
    setCardOrder(ids);
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(ids));
  }, []);

  const savePositions = useCallback((updater: (prev: Record<string, CardPosition>) => Record<string, CardPosition>) => {
    setCustomPositions((prev) => {
      const next = updater(prev);
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearCustomPositions = useCallback(() => {
    setCustomPositions({});
    localStorage.removeItem(POSITION_STORAGE_KEY);
    setLayoutVersion((v) => v + 1);
  }, []);

  const orderedCards = useMemo(() => {
    const ordered = cardOrder.map((id) => baseCards.find((c) => c.id === id)).filter(Boolean) as NavCardItem[];
    const missing = baseCards.filter((c) => !cardOrder.includes(c.id));
    return [...ordered, ...missing];
  }, [cardOrder, baseCards]);

  const columns = containerWidth >= 1024 ? 3 : containerWidth >= 640 ? 2 : 1;
  const cardWidth = Math.max(220, (containerWidth - CARD_GAP * (columns - 1)) / columns);

  const layoutPositions = useMemo(() => {
    const pos: Record<string, CardPosition> = {};
    orderedCards.forEach((card, i) => {
      pos[card.id] = {
        x: (i % columns) * (cardWidth + CARD_GAP),
        y: Math.floor(i / columns) * (CARD_HEIGHT + CARD_GAP),
      };
    });
    return pos;
  }, [orderedCards, columns, cardWidth]);

  const resolvedPositions = useMemo(() => {
    const pos: Record<string, CardPosition> = {};
    orderedCards.forEach((card) => {
      pos[card.id] = customPositions[card.id] ?? layoutPositions[card.id] ?? { x: 0, y: 0 };
    });
    return pos;
  }, [orderedCards, customPositions, layoutPositions]);

  const baseRows = Math.max(1, Math.ceil(orderedCards.length / columns));
  const baseCanvasHeight = baseRows * CARD_HEIGHT + (baseRows - 1) * CARD_GAP;
  const furthestY = orderedCards.reduce((max, c) => Math.max(max, resolvedPositions[c.id]?.y ?? 0), 0);
  const canvasHeight = Math.max(baseCanvasHeight, furthestY + CARD_HEIGHT + CARD_GAP);

  const handleDragStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleDragEnd = useCallback((cardId: string, info: PanInfo) => {
    // Keep isDragging true briefly to block the click
    setTimeout(() => { isDragging.current = false; }, 200);

    if (Math.abs(info.offset.x) < 5 && Math.abs(info.offset.y) < 5) return;

    const cur = resolvedPositions[cardId] ?? { x: 0, y: 0 };
    const maxX = Math.max(0, containerWidth - cardWidth);
    const maxY = Math.max(0, canvasHeight - CARD_HEIGHT);

    savePositions((prev) => ({
      ...prev,
      [cardId]: {
        x: Math.min(Math.max(cur.x + info.offset.x, 0), maxX),
        y: Math.min(Math.max(cur.y + info.offset.y, 0), maxY),
      },
    }));
  }, [resolvedPositions, containerWidth, cardWidth, canvasHeight, savePositions]);

  const handleCardClick = useCallback((route: string) => {
    if (isDragging.current) return;
    navigate(route);
  }, [navigate]);

  const autoOrganize = useCallback(() => {
    const sorted = [...baseCards].sort((a, b) => a.title.localeCompare(b.title, "pt-BR")).map((c) => c.id);
    saveOrder(sorted);
    clearCustomPositions();
  }, [baseCards, saveOrder, clearCustomPositions]);

  const resetLayout = useCallback(() => {
    saveOrder(defaultOrder);
    clearCustomPositions();
  }, [defaultOrder, saveOrder, clearCustomPositions]);

  const totalRisk = MOCK_GOALS.reduce((s, g) => s + g.risk, 0);
  const goalsAtRisk = MOCK_GOALS.filter((g) => g.risk > 0).length;
  const avgAttainment = Math.round(
    MOCK_GOALS.reduce((s, g) => {
      const att = g.type === "DOC" ? (g.current >= g.target ? 100 : 0) : Math.min(100, (g.current / g.target) * 100);
      return s + att;
    }, 0) / MOCK_GOALS.length
  );
  const pendingEvidence = MOCK_GOALS.filter((g) => g.type === "DOC" && g.current < g.target).length;

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

        <div className="flex justify-end gap-2 mb-3">
          <Button variant="outline" size="sm" onClick={resetLayout} className="gap-2 text-xs">
            <RotateCcw className="h-4 w-4" />
            Resetar padrão
          </Button>
          <Button variant="outline" size="sm" onClick={autoOrganize} className="gap-2 text-xs">
            <ArrowDownAZ className="h-4 w-4" />
            Auto Organizar
          </Button>
        </div>

        <div ref={containerRef} className="relative w-full" style={{ height: canvasHeight }}>
          {orderedCards.map((card) => {
            const pos = resolvedPositions[card.id] ?? { x: 0, y: 0 };
            return (
              <motion.div
                key={`${card.id}-${layoutVersion}`}
                drag
                dragMomentum={false}
                dragElastic={0}
                dragConstraints={containerRef}
                initial={false}
                animate={{ x: pos.x, y: pos.y }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                whileDrag={{ scale: 1.04, zIndex: 30, boxShadow: "0 8px 30px rgba(0,0,0,0.15)" }}
                onDragStart={handleDragStart}
                onDragEnd={(_, info) => handleDragEnd(card.id, info)}
                className="absolute left-0 top-0 cursor-grab active:cursor-grabbing touch-none"
                style={{ width: cardWidth }}
              >
                <div onClick={() => handleCardClick(card.route)}>
                  <NavCard title={card.title} description={card.description} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

const NavCard = ({ title, description }: { title: string; description: string }) => (
  <div className="kpi-card text-left group w-full select-none">
    <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">{title}</h3>
    <p className="text-sm text-muted-foreground mt-1">{description}</p>
  </div>
);

export default Dashboard;
