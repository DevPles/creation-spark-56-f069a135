import { useNavigate } from "react-router-dom";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const sections = [
  { title: "Dashboard", desc: "Visão geral dos indicadores e KPIs. Clique em qualquer card para acessar o módulo correspondente." },
  { title: "Metas", desc: "Cadastro e acompanhamento de metas qualitativas e quantitativas por unidade." },
  { title: "Lançamento de Metas", desc: "Registro de valores realizados por meta, com seleção de período e notas." },
  { title: "Contratos", desc: "Gestão de contratos de gestão, com upload de PDF, rubricas e valores globais." },
  { title: "Controle de Rubrica", desc: "Dashboard financeiro de acompanhamento de rubricas alocadas vs executadas por contrato." },
  { title: "Evidências", desc: "Upload e validação de documentos comprobatórios. Pendências de rubricas estouradas aparecem automaticamente." },
  { title: "Relatórios", desc: "Geração de relatórios em PDF e visualização de gráficos consolidados com carrossel." },
  { title: "Risco", desc: "Matriz de risco e acompanhamento de indicadores críticos por unidade." },
  { title: "SAU", desc: "Módulo de acompanhamento do Serviço de Atendimento ao Usuário." },
  { title: "Administração", desc: "Gestão de usuários, papéis e permissões do sistema (apenas administradores)." },
];

const TreinamentoPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full mb-4">
          ← Voltar
        </Button>

        <div className="mb-8">
          <h1 className="font-display text-xl font-bold text-foreground">Treinamento do Sistema</h1>
          <p className="text-sm text-muted-foreground">Guia completo dos módulos e funcionalidades disponíveis</p>
        </div>

        <div className="space-y-4">
          {sections.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="kpi-card"
            >
              <h2 className="text-sm font-bold text-foreground mb-1">{s.title}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default TreinamentoPage;
