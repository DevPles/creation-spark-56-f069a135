import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import KpiCard from "@/components/KpiCard";
import { motion, Reorder } from "framer-motion";
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

const STORAGE_KEY = "dashboard-card-order";

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();

  const allowedCards = profile?.allowed_cards;
  let baseCards = allowedCards && allowedCards.length > 0
    ? ALL_NAV_CARDS.filter(card => allowedCards.includes(card.id))
    : ALL_NAV_CARDS;

  if (!isAdmin) {
    baseCards = baseCards.filter(c => !FINANCIAL_CARD_IDS.includes(c.id));
  }

  const [cardOrder, setCardOrder] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        // Keep only valid IDs and add any new ones
        const validIds = baseCards.map(c => c.id);
        const ordered = parsed.filter(id => validIds.includes(id));
        const missing = validIds.filter(id => !ordered.includes(id));
        setCardOrder([...ordered, ...missing]);
        return;
      }
    } catch {}
    setCardOrder(baseCards.map(c => c.id));
  }, []);

  const orderedCards = cardOrder
    .map(id => baseCards.find(c => c.id === id))
    .filter(Boolean) as typeof baseCards;

  // Add any cards not in order yet
  const missingCards = baseCards.filter(c => !cardOrder.includes(c.id));
  const allOrderedCards = [...orderedCards, ...missingCards];

  const saveOrder = useCallback((ids: string[]) => {
    setCardOrder(ids);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, []);

  const autoOrganize = useCallback(() => {
    const sorted = [...baseCards].sort((a, b) => a.title.localeCompare(b.title, "pt-BR")).map(c => c.id);
    saveOrder(sorted);
  }, [baseCards, saveOrder]);

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
          <Button variant="outline" size="sm" onClick={autoOrganize} className="gap-2 text-xs">
            <ArrowDownAZ className="h-4 w-4" />
            Auto Organizar
          </Button>
        </div>

        {/* Navigation Cards - drag to reorder */}
        <Reorder.Group
          axis="y"
          values={allOrderedCards.map(c => c.id)}
          onReorder={(newOrder) => saveOrder(newOrder)}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          as="div"
        >
          {allOrderedCards.map((card) => (
            <Reorder.Item
              key={card.id}
              value={card.id}
              as="div"
              className="cursor-grab active:cursor-grabbing"
              whileDrag={{ scale: 1.04, boxShadow: "0 12px 40px -8px rgba(0,0,0,0.18)", zIndex: 50 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <NavCard
                title={card.title}
                description={card.description}
                onClick={() => navigate(card.route)}
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>
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
