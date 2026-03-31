import TopBar from "@/components/TopBar";
import PageHeader from "@/components/PageHeader";

const ControleRubricaPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PageHeader title="Controle de Rubrica" subtitle="Gestão e acompanhamento de rubricas" />
        <div className="mt-6">
          <div className="kpi-card p-8 text-center">
            <p className="text-muted-foreground">Módulo em construção — funcionalidades serão adicionadas em breve.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ControleRubricaPage;
