import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useContracts } from "@/contexts/ContractsContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const RelatorioAssistencialPage = () => {
  const navigate = useNavigate();
  const { contracts } = useContracts();
  const [selectedContractId, setSelectedContractId] = useState("");

  const selectedContract = contracts.find((c) => c.id === selectedContractId);

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          ← Voltar
        </Button>

        <PageHeader title="Relatório Assistencial" subtitle="Indicadores e dados assistenciais" />

        <div className="mt-6 space-y-6">
          {/* Contract selector */}
          <div className="space-y-2 max-w-md">
            <Label>Contrato de gestão</Label>
            <Select value={selectedContractId} onValueChange={setSelectedContractId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o contrato para análise" />
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

          {/* Contract PDF viewer */}
          {selectedContract ? (
            selectedContract.pdfUrl ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedContract.pdfName || "Contrato de gestão"}</p>
                    <p className="text-xs text-muted-foreground">Analise os pontos relevantes do contrato para compor o relatório assistencial</p>
                  </div>
                  <a
                    href={selectedContract.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline hover:no-underline"
                  >
                    Abrir em nova aba →
                  </a>
                </div>
                <iframe
                  src={selectedContract.pdfUrl}
                  title="Contrato de gestão"
                  className="w-full h-[70vh] rounded-lg border border-border"
                />
              </div>
            ) : (
              <div className="kpi-card p-8 text-center">
                <p className="text-muted-foreground">Este contrato não possui PDF anexado.</p>
                <p className="text-xs text-muted-foreground mt-1">Faça upload do PDF no cadastro do contrato para visualizá-lo aqui.</p>
              </div>
            )
          ) : (
            <div className="kpi-card p-8 text-center">
              <p className="text-muted-foreground">Selecione um contrato de gestão acima para visualizar o documento e analisar os pontos importantes.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default RelatorioAssistencialPage;
