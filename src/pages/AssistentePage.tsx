import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import TopBar from "@/components/TopBar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import GoalFormModal from "@/components/GoalFormModal";
import ContractFormModal from "@/components/ContractFormModal";
import EvidenceFormModal from "@/components/EvidenceFormModal";
import PdfExportModal from "@/components/PdfExportModal";
import { GoalData } from "@/components/GoalFormModal";
import { ContractData } from "@/components/contract/types";
import { EvidenceData } from "@/components/EvidenceFormModal";

type Step = "inicio" | "cadastrar" | "consultar" | "relatorios";

interface WizardCard {
  id: string;
  title: string;
  description: string;
  action: () => void;
}

const AssistentePage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("inicio");
  const [history, setHistory] = useState<Step[]>([]);

  // Modal states
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const goTo = (next: Step) => {
    setHistory(prev => [...prev, step]);
    setStep(next);
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setStep(prev);
    } else {
      navigate("/dashboard");
    }
  };

  const progressMap: Record<Step, number> = {
    inicio: 33,
    cadastrar: 66,
    consultar: 66,
    relatorios: 100,
  };

  const stepTitles: Record<Step, string> = {
    inicio: "O que deseja fazer?",
    cadastrar: "Escolha o que cadastrar",
    consultar: "Escolha o que consultar",
    relatorios: "Gerar relatório",
  };

  const stepDescriptions: Record<Step, string> = {
    inicio: "Selecione uma das opções abaixo para começar. Cada caminho irá guiá-lo passo a passo.",
    cadastrar: "Selecione o tipo de informação que deseja registrar no sistema.",
    consultar: "Acesse rapidamente as informações já cadastradas.",
    relatorios: "Gere relatórios consolidados em PDF.",
  };

  const getCards = (): WizardCard[] => {
    switch (step) {
      case "inicio":
        return [
          {
            id: "cadastrar",
            title: "Cadastrar / Lançar dados",
            description: "Registre novas metas, contratos, leitos, evidências ou lançamentos de rubricas no sistema.",
            action: () => goTo("cadastrar"),
          },
          {
            id: "consultar",
            title: "Consultar informações",
            description: "Visualize metas, contratos, rubricas e projeções de risco já cadastrados.",
            action: () => goTo("consultar"),
          },
          {
            id: "relatorios",
            title: "Gerar relatórios",
            description: "Crie relatórios em PDF com os dados consolidados do período selecionado.",
            action: () => setPdfModalOpen(true),
          },
        ];

      case "cadastrar":
        return [
          {
            id: "meta",
            title: "Cadastrar Meta",
            description: "Crie uma nova meta quantitativa, qualitativa ou documental com faixas de pontuação.",
            action: () => setGoalModalOpen(true),
          },
          {
            id: "contrato",
            title: "Cadastrar Contrato",
            description: "Registre um novo contrato de gestão com valores fixos, variáveis e leitos.",
            action: () => setContractModalOpen(true),
          },
          {
            id: "evidencia",
            title: "Enviar Evidência",
            description: "Faça upload de documentos comprobatórios vinculados a metas ou rubricas.",
            action: () => setEvidenceModalOpen(true),
          },
          {
            id: "lancamento",
            title: "Lançar Metas e Rubricas",
            description: "Acesse a tela de lançamentos para registrar valores mensais de metas e rubricas.",
            action: () => navigate("/lancamento"),
          },
          {
            id: "leitos",
            title: "Movimentação de Leitos",
            description: "Registre internações, altas, óbitos e transferências diárias por unidade.",
            action: () => navigate("/lancamento"),
          },
        ];

      case "consultar":
        return [
          {
            id: "ver-metas",
            title: "Ver Metas",
            description: "Consulte todas as metas cadastradas com detalhamento, histórico e projeções.",
            action: () => navigate("/metas"),
          },
          {
            id: "ver-contratos",
            title: "Ver Contratos",
            description: "Visualize os contratos vigentes, valores e status de cada unidade.",
            action: () => navigate("/contratos"),
          },
          {
            id: "ver-rubricas",
            title: "Ver Rubricas",
            description: "Acompanhe a execução orçamentária e projeção de risco por rubrica.",
            action: () => navigate("/controle-rubrica"),
          },
          {
            id: "ver-evidencias",
            title: "Ver Evidências",
            description: "Consulte documentos enviados e seus status de validação.",
            action: () => navigate("/evidencias"),
          },
          {
            id: "ver-sau",
            title: "Ver SAU",
            description: "Acesse o módulo de Serviço de Atendimento ao Usuário.",
            action: () => navigate("/sau"),
          },
        ];

      default:
        return [];
    }
  };

  const cards = getCards();

  const newGoalTemplate: GoalData = {
    id: "",
    name: "",
    target: 0,
    current: 0,
    unit: "%",
    type: "QNT",
    risk: 0,
    weight: 1,
    trend: "stable",
    scoring: [
      { min: 0, label: "Insuficiente", points: 0 },
      { min: 50, label: "Regular", points: 50 },
      { min: 80, label: "Bom", points: 80 },
      { min: 100, label: "Ótimo", points: 100 },
    ],
    history: [],
    glosaPct: 0,
  };

  const newEvidenceTemplate: EvidenceData = {
    id: "",
    goalName: "",
    type: "PDF",
    fileName: "",
    status: "Pendente",
    dueDate: new Date().toISOString().split("T")[0],
    notes: "",
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" onClick={goBack} className="text-sm">
              Voltar
            </Button>
            <span className="text-xs text-muted-foreground">
              Etapa {step === "inicio" ? 1 : 2} de 2
            </span>
          </div>
          <Progress value={progressMap[step]} className="h-2" />
        </div>

        {/* Step title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            {stepTitles[step]}
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {stepDescriptions[step]}
          </p>
        </div>

        {/* Cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 gap-4"
          >
            {cards.map((card, i) => (
              <motion.button
                key={card.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={card.action}
                className="kpi-card text-left cursor-pointer group p-6 hover:ring-2 hover:ring-primary/30 transition-all"
              >
                <h3 className="font-display font-semibold text-lg text-foreground group-hover:text-primary transition-colors mb-1">
                  {card.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      <GoalFormModal
        goal={newGoalTemplate}
        open={goalModalOpen}
        onOpenChange={setGoalModalOpen}
        onSave={() => setGoalModalOpen(false)}
        isNew
      />

      <ContractFormModal
        contract={null}
        open={contractModalOpen}
        onOpenChange={setContractModalOpen}
        onSave={() => setContractModalOpen(false)}
        isNew
      />

      <EvidenceFormModal
        evidence={newEvidenceTemplate}
        open={evidenceModalOpen}
        onOpenChange={setEvidenceModalOpen}
        onSave={() => setEvidenceModalOpen(false)}
        isNew
      />

      <PdfExportModal
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
        onGenerate={() => setPdfModalOpen(false)}
      />
    </div>
  );
};

export default AssistentePage;
