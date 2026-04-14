import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useContracts } from "@/contexts/ContractsContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ReportSectionEditor from "@/components/ReportSectionEditor";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

// Sections matching the document sumário
const REPORT_SECTIONS = [
  {
    key: "info_contrato",
    title: "01. Informações do Contrato",
    description: "Contratante, contratado, CNPJ, tipo de beneficiário, contrato, processo, unidade gestora, CNES e informações da Organização Social.",
    order: 1,
  },
  {
    key: "caract_unidade",
    title: "02. Caracterização da Unidade",
    description: "Infraestrutura da unidade, serviços terceirizados, serviços ofertados aos usuários e especialidades médicas.",
    order: 2,
  },
  {
    key: "implantacao_processos",
    title: "03. Implantação dos Processos",
    description: "Histórico de evolução e atuação nos processos de melhoria executados.",
    order: 3,
  },
  {
    key: "doc_regulatoria",
    title: "04. Documentação Regulatória",
    description: "Alvarás de funcionamento, licenças, registros no CRM, COREN e demais conselhos profissionais.",
    order: 4,
  },
  {
    key: "doc_operacional",
    title: "05. Documentação Operacional",
    description: "Procedimentos Operacional Padrão (POP), instruções sequenciais e documentos operacionais.",
    order: 5,
  },
  {
    key: "recursos_humanos",
    title: "06. Recursos Humanos",
    description: "Contratações, desligamentos, transferências, CNES dos funcionários, escalas, turnover e absenteísmo.",
    order: 6,
  },
  {
    key: "seg_trabalho",
    title: "07. Segurança do Trabalho",
    description: "Acidentes de trabalho e indicadores de segurança ocupacional.",
    order: 7,
  },
  {
    key: "treinamentos",
    title: "08. Treinamentos",
    description: "Indicadores de treinamento: horas de treinamento e total de participantes.",
    order: 8,
  },
  {
    key: "humanizacao",
    title: "09. Humanização",
    description: "Ações de humanização e acolhimento na unidade.",
    order: 9,
  },
  {
    key: "indicadores_assistenciais",
    title: "10. Indicadores Assistenciais",
    description: "Dados sobre óbitos, desempenho assistencial, indicadores de linha cirúrgica, CME, classificação de risco, enfermagem, farmácia/almoxarifado, SADT, referência e contrarreferência.",
    order: 10,
  },
  {
    key: "indicadores_qualidade",
    title: "11. Indicadores de Qualidade",
    description: "Indicadores referentes às comissões, equipe multidisciplinar e serviço de atendimento ao usuário.",
    order: 11,
  },
  {
    key: "indicadores_acompanhamento",
    title: "12. Indicadores de Acompanhamento",
    description: "Indicadores de acompanhamento dos serviços prestados.",
    order: 12,
  },
  {
    key: "tecnologia_info",
    title: "13. Tecnologia de Informação",
    description: "Sistemas, prontuário eletrônico e infraestrutura de TI.",
    order: 13,
  },
  {
    key: "servicos_terceirizados",
    title: "14. Serviços Terceirizados",
    description: "Detalhamento dos serviços terceirizados contratados.",
    order: 14,
  },
  {
    key: "eventos_campanhas",
    title: "15. Eventos e Campanhas",
    description: "Eventos, campanhas e atividades assistenciais e administrativas realizadas.",
    order: 15,
  },
  {
    key: "faturamento",
    title: "16. Faturamento",
    description: "Dados de faturamento e produção do período.",
    order: 16,
  },
  {
    key: "anexos",
    title: "17. Anexos",
    description: "Documentos, planilhas e evidências complementares.",
    order: 17,
  },
  {
    key: "consideracoes_finais",
    title: "18. Considerações Finais",
    description: "Conclusões, observações e recomendações do período.",
    order: 18,
  },
];

interface SectionData {
  id: string | null;
  content: string;
  attachments: Array<{
    id: string;
    file_name: string;
    file_url: string;
    file_type: string;
  }>;
}

const RelatorioAssistencialPage = () => {
  const navigate = useNavigate();
  const { contracts } = useContracts();
  const { user } = useAuth();
  const [selectedContractId, setSelectedContractId] = useState("");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  });
  const [activeSection, setActiveSection] = useState(REPORT_SECTIONS[0].key);
  const [sectionsData, setSectionsData] = useState<Record<string, SectionData>>({});
  const [generating, setGenerating] = useState(false);

  const selectedContract = contracts.find((c) => c.id === selectedContractId);
  const unit = selectedContract?.unit || "";
  const userId = user?.id || "";

  // Load sections from DB
  const loadSections = useCallback(async () => {
    if (!selectedContractId || !period) return;

    const { data: sections } = await supabase
      .from("report_sections")
      .select("*")
      .eq("contract_id", selectedContractId)
      .eq("period", period);

    const sectionIds = (sections || []).map((s: any) => s.id);

    let attachments: any[] = [];
    if (sectionIds.length > 0) {
      const { data } = await supabase
        .from("report_attachments")
        .select("*")
        .in("section_id", sectionIds);
      attachments = data || [];
    }

    const dataMap: Record<string, SectionData> = {};
    REPORT_SECTIONS.forEach((sec) => {
      const dbSection = (sections || []).find((s: any) => s.section_key === sec.key);
      dataMap[sec.key] = {
        id: dbSection?.id || null,
        content: dbSection?.content || "",
        attachments: attachments
          .filter((a: any) => a.section_id === dbSection?.id)
          .map((a: any) => ({
            id: a.id,
            file_name: a.file_name,
            file_url: a.file_url,
            file_type: a.file_type,
          })),
      };
    });

    setSectionsData(dataMap);
  }, [selectedContractId, period]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const handleContentChange = (key: string, content: string) => {
    setSectionsData((prev) => ({
      ...prev,
      [key]: { ...prev[key], content },
    }));
  };

  // Count filled sections
  const filledCount = useMemo(() => {
    return REPORT_SECTIONS.filter((sec) => {
      const data = sectionsData[sec.key];
      return data && (data.content.trim().length > 0 || data.attachments.length > 0);
    }).length;
  }, [sectionsData]);

  const handleExportPdf = async () => {
    if (!selectedContract) return;
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const primary: [number, number, number] = [30, 58, 95];
      const pageWidth = doc.internal.pageSize.getWidth();

      // Cover page
      doc.setFillColor(primary[0], primary[1], primary[2]);
      doc.rect(0, 0, pageWidth, 50, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("RELATÓRIO ASSISTENCIAL", pageWidth / 2, 25, { align: "center" });
      doc.setFontSize(12);
      doc.text("Gerência, Operacionalização e Execução das Ações e Serviços de Saúde", pageWidth / 2, 35, { align: "center" });
      doc.setFontSize(10);
      doc.text(`${selectedContract.name} — ${unit}`, pageWidth / 2, 45, { align: "center" });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Período de Referência: ${period}`, pageWidth / 2, 65, { align: "center" });
      doc.setFontSize(9);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth / 2, 75, { align: "center" });

      // Sumário page
      doc.addPage();
      doc.setFillColor(primary[0], primary[1], primary[2]);
      doc.rect(0, 0, pageWidth, 15, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text("SUMÁRIO", 14, 11);
      doc.setTextColor(0, 0, 0);

      let sy = 25;
      REPORT_SECTIONS.forEach((sec) => {
        doc.setFontSize(10);
        doc.text(sec.title, 14, sy);
        sy += 7;
        if (sy > 280) {
          doc.addPage();
          sy = 20;
        }
      });

      // Content pages
      REPORT_SECTIONS.forEach((sec) => {
        const data = sectionsData[sec.key];
        const content = data?.content || "";
        const attachments = data?.attachments || [];

        doc.addPage();

        // Section header
        doc.setFillColor(primary[0], primary[1], primary[2]);
        doc.rect(0, 0, pageWidth, 15, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.text(sec.title, 14, 11);

        doc.setTextColor(0, 0, 0);
        let y = 25;

        if (content.trim()) {
          doc.setFontSize(10);
          const lines = doc.splitTextToSize(content, pageWidth - 28);
          for (const line of lines) {
            if (y > 275) {
              doc.addPage();
              y = 20;
            }
            doc.text(line, 14, y);
            y += 5;
          }
        } else {
          doc.setFontSize(10);
          doc.setTextColor(150, 150, 150);
          doc.text("Seção não preenchida.", 14, y);
          doc.setTextColor(0, 0, 0);
        }

        // List attachments
        if (attachments.length > 0) {
          y += 8;
          if (y > 270) { doc.addPage(); y = 20; }
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text("Anexos:", 14, y);
          doc.setFont("helvetica", "normal");
          y += 6;
          attachments.forEach((att) => {
            if (y > 280) { doc.addPage(); y = 20; }
            doc.setFontSize(9);
            doc.text(`• ${att.file_name}`, 18, y);
            y += 5;
          });
        }
      });

      // Footer on all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Relatório Assistencial — ${selectedContract.name} — ${period} — Página ${i}/${pageCount}`,
          14,
          290
        );
      }

      doc.save(`relatorio_assistencial_${unit.replace(/\s/g, "_")}_${period.replace("/", "-")}.pdf`);
      toast.success("Relatório PDF exportado com sucesso");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  const activeSectionDef = REPORT_SECTIONS.find((s) => s.key === activeSection)!;
  const activeSectionData = sectionsData[activeSection] || { id: null, content: "", attachments: [] };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          Voltar
        </Button>

        <PageHeader
          title="Relatório Assistencial"
          subtitle="Preencha cada seção do relatório para gerar o documento final em PDF"
          action={
            <div className="flex items-center gap-3">
              <div className="w-36">
                <Label className="text-xs text-muted-foreground">Período</Label>
                <Input
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="MM/AAAA"
                  className="h-9 text-sm"
                />
              </div>
              <div className="w-64">
                <Label className="text-xs text-muted-foreground">Contrato</Label>
                <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione o contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          }
        />

        {!selectedContract ? (
          <div className="kpi-card p-8 text-center">
            <p className="text-muted-foreground">Selecione um contrato para preencher o relatório assistencial.</p>
          </div>
        ) : (
          <div className="flex gap-6 mt-4">
            {/* Left sidebar - navigation */}
            <div className="w-72 shrink-0">
              <div className="bg-card rounded-lg border border-border p-3 sticky top-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-foreground">Sumário</h3>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {filledCount}/{REPORT_SECTIONS.length}
                  </span>
                </div>
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="space-y-1 pr-2">
                    {REPORT_SECTIONS.map((sec) => {
                      const data = sectionsData[sec.key];
                      const filled = data && (data.content.trim().length > 0 || data.attachments.length > 0);
                      const isActive = activeSection === sec.key;
                      return (
                        <button
                          key={sec.key}
                          onClick={() => setActiveSection(sec.key)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                            isActive
                              ? "bg-primary text-primary-foreground font-medium"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              filled ? "bg-emerald-500" : isActive ? "bg-primary-foreground/50" : "bg-muted-foreground/30"
                            }`}
                          />
                          <span className="truncate">{sec.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* Export button */}
                <div className="mt-4 pt-3 border-t border-border">
                  <Button
                    onClick={handleExportPdf}
                    disabled={generating}
                    className="w-full"
                    size="sm"
                  >
                    {generating ? "Gerando..." : "Gerar PDF do Relatório"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right content - section editor */}
            <div className="flex-1 min-w-0">
              <div className="bg-card rounded-lg border border-border p-6">
                <ReportSectionEditor
                  key={`${activeSection}-${selectedContractId}-${period}`}
                  sectionId={activeSectionData.id}
                  sectionKey={activeSection}
                  sectionTitle={activeSectionDef.title}
                  sectionDescription={activeSectionDef.description}
                  content={activeSectionData.content}
                  attachments={activeSectionData.attachments}
                  contractId={selectedContractId}
                  facilityUnit={unit}
                  period={period}
                  sortOrder={activeSectionDef.order}
                  userId={userId}
                  onContentChange={(content) => handleContentChange(activeSection, content)}
                  onSave={loadSections}
                  onAttachmentsChange={loadSections}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default RelatorioAssistencialPage;
