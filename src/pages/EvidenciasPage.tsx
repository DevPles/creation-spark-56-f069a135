import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import EvidenceFormModal, { EvidenceData } from "@/components/EvidenceFormModal";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { getEstouradasByUnit } from "@/data/rubricaData";

const GOAL_UNIT_MAP: Record<string, string> = {
  "Taxa de ocupação de leitos": "Hospital Geral",
  "Tempo médio de espera": "Hospital Geral",
  "Satisfação do paciente (NPS)": "UPA Norte",
  "Protocolo de higienização": "UPA Norte",
  "Relatório quadrimestral (RDQA)": "UBS Centro",
  "Taxa de infecção hospitalar": "UBS Centro",
  "Cirurgias eletivas realizadas": "UPA Norte",
  "Comissão de óbitos ativa": "Hospital Geral",
};

const GOAL_NAMES = [
  "Taxa de ocupação de leitos", "Tempo médio de espera", "Satisfação do paciente (NPS)",
  "Protocolo de higienização", "Relatório quadrimestral (RDQA)", "Taxa de infecção hospitalar",
  "Cirurgias eletivas realizadas", "Comissão de óbitos ativa",
];

const INITIAL_EVIDENCE: EvidenceData[] = [
  { id: "1", goalName: "Relatório quadrimestral (RDQA)", type: "Relatório", fileName: "", status: "Pendente", dueDate: "2024-04-30", notes: "Relatório do 1º quadrimestre pendente", facilityUnit: "UBS Centro" },
  { id: "2", goalName: "Protocolo de higienização", type: "Checklist", fileName: "checklist_higiene_mar.pdf", status: "Enviada", dueDate: "2024-03-31", submittedAt: "28/03/2024", notes: "", facilityUnit: "UPA Norte" },
  { id: "3", goalName: "Comissão de óbitos ativa", type: "Ata de reunião", fileName: "ata_comissao_obitos_fev.pdf", status: "Validada", dueDate: "2024-02-28", submittedAt: "25/02/2024", notes: "Validado pelo gestor", facilityUnit: "Hospital Geral" },
  { id: "4", goalName: "Satisfação do paciente (NPS)", type: "Pesquisa", fileName: "pesquisa_nps_q1.xlsx", status: "Rejeitada", dueDate: "2024-03-15", submittedAt: "14/03/2024", notes: "Amostra insuficiente - refazer", facilityUnit: "UPA Norte" },
];

const STATUS_STYLES: Record<string, string> = { Pendente: "status-warning", Enviada: "bg-accent text-accent-foreground", Validada: "status-success", Rejeitada: "status-critical" };

const EvidenciasPage = () => {
  const navigate = useNavigate();
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");
  const [evidences, setEvidences] = useState<EvidenceData[]>(INITIAL_EVIDENCE);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);

  // Get estouradas from rubrica data
  const estouradas = useMemo(() => getEstouradasByUnit(), []);

  // Generate pending evidence items for estouradas that don't have a justification
  const rubricaPendencias = useMemo(() => {
    return estouradas
      .filter(est => {
        // Check if there's already a justification evidence for this rubrica
        const hasJustification = evidences.some(
          ev => ev.goalName === `Justificativa: ${est.rubrica} (${est.unit})` && ev.status !== "Rejeitada"
        );
        return !hasJustification;
      })
      .map(est => ({
        id: `rubrica-${est.unit}-${est.rubrica}`,
        goalName: `Justificativa: ${est.rubrica} (${est.unit})`,
        type: "Justificativa Interna",
        fileName: "",
        status: "Pendente" as const,
        dueDate: new Date().toISOString().split("T")[0],
        submittedAt: undefined as string | undefined,
        notes: `Rubrica estourada: ${est.pctExec}% executado (excedente de R$ ${(est.excedente / 1000).toFixed(0)}k). Necessária justificativa.`,
        facilityUnit: est.unit,
        isRubricaPendencia: true,
      }));
  }, [estouradas, evidences]);

  const allEvidences = useMemo(() => {
    return [...rubricaPendencias, ...evidences];
  }, [rubricaPendencias, evidences]);

  const filteredGoalNames =
    selectedUnit === "Todas as unidades"
      ? GOAL_NAMES
      : GOAL_NAMES.filter((goalName) => GOAL_UNIT_MAP[goalName] === selectedUnit);

  const filteredEvidences =
    selectedUnit === "Todas as unidades"
      ? allEvidences
      : allEvidences.filter((evidence) => evidence.facilityUnit === selectedUnit);

  const handleNew = () => {
    setSelectedEvidence(null);
    setIsNew(true);
    setModalOpen(true);
  };

  const handleClick = (ev: EvidenceData) => {
    setSelectedEvidence(ev);
    setIsNew(false);
    setModalOpen(true);
  };

  const handleSave = (ev: EvidenceData) => {
    const nextEvidence: EvidenceData = {
      ...ev,
      facilityUnit:
        ev.facilityUnit ||
        (selectedUnit !== "Todas as unidades" ? selectedUnit : GOAL_UNIT_MAP[ev.goalName] || "Hospital Geral"),
    };

    if (isNew) setEvidences((prev) => [...prev, nextEvidence]);
    else setEvidences((prev) => prev.map((e) => (e.id === nextEvidence.id ? nextEvidence : e)));
  };

  const pending = filteredEvidences.filter((e) => e.status === "Pendente").length;
  const validated = filteredEvidences.filter((e) => e.status === "Validada").length;
  const rejected = filteredEvidences.filter((e) => e.status === "Rejeitada").length;
  const rubricaPendingCount = rubricaPendencias.filter(
    rp => selectedUnit === "Todas as unidades" || rp.facilityUnit === selectedUnit
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          Voltar
        </Button>

        <PageHeader
          title="Plano de Ação"
          subtitle="Análise crítica, ações corretivas e evidências comprobatórias"
          selectedUnit={selectedUnit}
          onUnitChange={setSelectedUnit}
          action={<Button onClick={handleNew}>Nova evidência</Button>}
        />

        {/* Rubrica estourada alert */}
        {rubricaPendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 mb-6 rounded-lg border border-destructive/30 bg-destructive/5"
          >
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {rubricaPendingCount} pendência{rubricaPendingCount > 1 ? "s" : ""} de justificativa de rubrica estourada
              </p>
              <p className="text-xs text-muted-foreground">
                Insira evidências de justificativa para rubricas que ultrapassaram o orçamento projetado
              </p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Total</p><p className="kpi-value">{filteredEvidences.length}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Pendentes</p><p className="kpi-value text-warning">{pending}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Validadas</p><p className="kpi-value text-success">{validated}</p></div>
          <div className="kpi-card"><p className="text-xs text-muted-foreground">Rejeitadas</p><p className="kpi-value text-risk">{rejected}</p></div>
          <div className="kpi-card">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-destructive" /> Rubricas estouradas
            </p>
            <p className="kpi-value text-destructive">{rubricaPendingCount}</p>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border grid grid-cols-12 text-xs font-medium text-muted-foreground">
            <span className="col-span-3">Meta / Rubrica vinculada</span><span className="col-span-2">Tipo</span><span className="col-span-2">Arquivo</span><span className="col-span-2">Prazo</span><span className="col-span-1">Envio</span><span className="col-span-2">Status</span>
          </div>
          {filteredEvidences.map((ev, i) => {
            const isRubrica = "isRubricaPendencia" in ev;
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => handleClick(ev)}
                className={`px-5 py-3 grid grid-cols-12 items-center text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${isRubrica ? "bg-destructive/5" : ""}`}
              >
                <span className="col-span-3 font-medium text-foreground truncate flex items-center gap-1.5">
                  {isRubrica && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                  {ev.goalName}
                </span>
                <span className={`col-span-2 ${isRubrica ? "text-destructive font-medium" : "text-muted-foreground"}`}>{ev.type}</span>
                <span className="col-span-2 text-muted-foreground truncate">{ev.fileName || "—"}</span>
                <span className="col-span-2 text-muted-foreground">{ev.dueDate}</span>
                <span className="col-span-1 text-muted-foreground text-xs">{ev.submittedAt || "—"}</span>
                <span className="col-span-2"><span className={`status-badge ${STATUS_STYLES[ev.status]}`}>{ev.status}</span></span>
              </motion.div>
            );
          })}
        </div>
      </main>
      <EvidenceFormModal evidence={selectedEvidence} open={modalOpen} onOpenChange={setModalOpen} onSave={handleSave} isNew={isNew} goalNames={filteredGoalNames} />
    </div>
  );
};

export default EvidenciasPage;
