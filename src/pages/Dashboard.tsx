import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import KpiCard from "@/components/KpiCard";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowDownAZ } from "lucide-react";
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
  { id: "evidencias", title: "Evidências", description: "Upload e validação de documentos", route: "/evidencias" },
  { id: "relatorios", title: "Relatórios", description: "Gerar PDF consolidado por período", route: "/relatorios" },
  { id: "admin", title: "Administração", description: "Usuários, perfis e permissões", route: "/admin" },
  { id: "lancamento", title: "Lançamentos", description: "Lançamento de metas e rubricas", route: "/lancamento" },
  { id: "sau", title: "SAU", description: "Serviço de Atendimento ao Usuário", route: "/sau" },
  { id: "relatorio-assistencial", title: "Relatório Assistencial", description: "Indicadores e dados assistenciais", route: "/relatorio-assistencial" },
  { id: "controle-rubrica", title: "Controle de Rubrica", description: "Gestão e acompanhamento de rubricas", route: "/controle-rubrica" },
];

const STORAGE_KEY = "dashboard-card-positions";

interface CardPosition {
  x: number;
  y: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  const allowedCards = profile?.allowed_cards;
  let baseCards = allowedCards && allowedCards.length > 0
    ? ALL_NAV_CARDS.filter(card => allowedCards.includes(card.id))
    : ALL_NAV_CARDS;

  if (!isAdmin) {
    baseCards = baseCards.filter(c => !FINANCIAL_CARD_IDS.includes(c.id));
  }

  const visibleCards = baseCards;

  // Positions: { [cardId]: { x, y } } — relative to grid container
  const [positions, setPositions] = useState<Record<string, CardPosition>>({});
  const [isDragging, setIsDragging] = useState(false);

  // Load saved positions
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPositions(JSON.parse(saved));
    } catch {}
  }, []);

  const savePositions = useCallback((pos: Record<string, CardPosition>) => {
    setPositions(pos);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  }, []);

  // Calculate grid positions for auto-organize
  const getGridPositions = useCallback((): Record<string, CardPosition> => {
    const cols = 3;
    const gap = 16;
    const containerWidth = containerRef.current?.offsetWidth || 1100;
    const cardWidth = (containerWidth - gap * (cols - 1)) / cols;
    const cardHeight = 80;
    const result: Record<string, CardPosition> = {};
    
    const sorted = [...visibleCards].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    sorted.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      result[card.id] = { x: col * (cardWidth + gap), y: row * (cardHeight + gap) };
    });
    return result;
  }, [visibleCards]);

  const autoOrganize = useCallback(() => {
    const gridPos = getGridPositions();
    savePositions(gridPos);
  }, [getGridPositions, savePositions]);

  // Reset to no custom positions (natural grid flow)
  const resetPositions = useCallback(() => {
    savePositions({});
  }, [savePositions]);

  const hasCustomPositions = Object.keys(positions).length > 0;

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
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {isAdmin && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              onClick={() => navigate("/contratos")} className="cursor-pointer">
              <KpiCard label="R$ em risco" value={`R$ ${(totalRisk / 1000).toFixed(1)}k`} status="critical" subtitle="Contrato vigente" />
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            onClick={() => navigate("/metas")} className="cursor-pointer">
            <KpiCard label="Metas em risco" value={`${goalsAtRisk} de ${MOCK_GOALS.length}`} status="warning" subtitle="Abaixo do pactuado" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            onClick={() => navigate("/relatorios")} className="cursor-pointer">
            <KpiCard label="Atingimento médio" value={`${avgAttainment}%`} status={avgAttainment >= 90 ? "success" : avgAttainment >= 70 ? "warning" : "critical"} subtitle="Todas as metas" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            onClick={() => navigate("/evidencias")} className="cursor-pointer">
            <KpiCard label="Evidências pendentes" value={String(pendingEvidence)} status={pendingEvidence > 0 ? "warning" : "success"} subtitle="Documentos a enviar" />
          </motion.div>
        </div>

        {/* Auto Organize button */}
        <div className="flex justify-end gap-2 mb-3">
          {hasCustomPositions && (
            <Button variant="ghost" size="sm" onClick={resetPositions} className="gap-2 text-xs text-muted-foreground">
              Resetar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={autoOrganize} className="gap-2 text-xs">
            <ArrowDownAZ className="h-4 w-4" />
            Auto Organizar
          </Button>
        </div>

        {/* Navigation Cards - free draggable */}
        <div
          ref={containerRef}
          className="relative"
          style={{ minHeight: hasCustomPositions ? `${Math.max(400, Math.max(...Object.values(positions).map(p => p.y)) + 120)}px` : "auto" }}
        >
          {hasCustomPositions ? (
            // Absolute positioning mode
            visibleCards.map((card) => {
              const pos = positions[card.id] || { x: 0, y: 0 };
              return (
                <motion.div
                  key={card.id}
                  drag
                  dragMomentum={false}
                  dragElastic={0}
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={(_, info) => {
                    setTimeout(() => setIsDragging(false), 100);
                    const newPos = {
                      ...positions,
                      [card.id]: {
                        x: pos.x + info.offset.x,
                        y: pos.y + info.offset.y,
                      },
                    };
                    savePositions(newPos);
                  }}
                  initial={false}
                  animate={{ x: pos.x, y: pos.y }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  style={{ position: "absolute", width: "calc(33.333% - 11px)", zIndex: isDragging ? 50 : 1 }}
                  className="cursor-grab active:cursor-grabbing"
                  whileDrag={{ scale: 1.04, boxShadow: "0 12px 40px -8px rgba(0,0,0,0.2)", zIndex: 50 }}
                >
                  <NavCard
                    title={card.title}
                    description={card.description}
                    onClick={() => { if (!isDragging) navigate(card.route); }}
                  />
                </motion.div>
              );
            })
          ) : (
            // Normal grid mode — still draggable to initiate free mode
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleCards.map((card) => (
                <motion.div
                  key={card.id}
                  drag
                  dragMomentum={false}
                  dragElastic={0}
                  dragSnapToOrigin
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={(_, info) => {
                    setTimeout(() => setIsDragging(false), 100);
                    // If dragged far enough, switch to absolute mode
                    if (Math.abs(info.offset.x) > 30 || Math.abs(info.offset.y) > 30) {
                      // Calculate current grid positions and apply offset to dragged card
                      const cols = 3;
                      const gap = 16;
                      const containerWidth = containerRef.current?.offsetWidth || 1100;
                      const cardWidth = (containerWidth - gap * (cols - 1)) / cols;
                      const cardHeight = 80;
                      const newPositions: Record<string, CardPosition> = {};
                      visibleCards.forEach((c, i) => {
                        const col = i % cols;
                        const row = Math.floor(i / cols);
                        newPositions[c.id] = {
                          x: col * (cardWidth + gap),
                          y: row * (cardHeight + gap),
                        };
                      });
                      // Apply offset to the dragged card
                      newPositions[card.id] = {
                        x: newPositions[card.id].x + info.offset.x,
                        y: newPositions[card.id].y + info.offset.y,
                      };
                      savePositions(newPositions);
                    }
                  }}
                  className="cursor-grab active:cursor-grabbing"
                  whileDrag={{ scale: 1.04, boxShadow: "0 12px 40px -8px rgba(0,0,0,0.2)", zIndex: 50 }}
                >
                  <NavCard
                    title={card.title}
                    description={card.description}
                    onClick={() => { if (!isDragging) navigate(card.route); }}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Admin Card - centered */}
        {false && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-32 lg:mt-40">
            <div className="hidden lg:block" />
            <NavCard title="Administração" description="Usuários, perfis e permissões" onClick={() => navigate("/admin")} />
          </div>
        )}
      </main>
    </div>
  );
};

const NavCard = ({ title, description, onClick }: { title: string; description: string; onClick: () => void }) => (
  <button onClick={onClick} className="kpi-card text-left cursor-pointer group w-full">
    <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">{title}</h3>
    <p className="text-sm text-muted-foreground mt-1">{description}</p>
  </button>
);

export default Dashboard;
