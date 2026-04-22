import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ContractsProvider } from "@/contexts/ContractsContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import FloatingTrainingHeart from "@/components/FloatingTrainingHeart";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MetasPage from "./pages/MetasPage";
import ContratosPage from "./pages/ContratosPage";

import AdminPage from "./pages/AdminPage";
import EvidenciasPage from "./pages/EvidenciasPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import LancamentoMetasPage from "./pages/LancamentoMetasPage";
import SauPage from "./pages/SauPage";
import RelatorioAssistencialPage from "./pages/RelatorioAssistencialPage";
import ControleRubricaPage from "./pages/ControleRubricaPage";
import TreinamentoPage from "./pages/TreinamentoPage";
import AssistentePage from "./pages/AssistentePage";
import OpmePage from "./pages/OpmePage";
import ComprasPage from "./pages/ComprasPage";
import PublicQuotationPage from "./pages/PublicQuotationPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ContractsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <FloatingTrainingHeart />
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/metas" element={<ProtectedRoute><MetasPage /></ProtectedRoute>} />
            <Route path="/contratos" element={<ProtectedRoute financialOnly><ContratosPage /></ProtectedRoute>} />
            
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
            <Route path="/evidencias" element={<ProtectedRoute><EvidenciasPage /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute financialOnly><RelatoriosPage /></ProtectedRoute>} />
            <Route path="/lancamento" element={<ProtectedRoute><LancamentoMetasPage /></ProtectedRoute>} />
            <Route path="/sau" element={<ProtectedRoute><SauPage /></ProtectedRoute>} />
            <Route path="/relatorio-assistencial" element={<ProtectedRoute financialOnly><RelatorioAssistencialPage /></ProtectedRoute>} />
            <Route path="/controle-rubrica" element={<ProtectedRoute financialOnly><ControleRubricaPage /></ProtectedRoute>} />
            <Route path="/treinamento" element={<ProtectedRoute><TreinamentoPage /></ProtectedRoute>} />
            <Route path="/assistente" element={<ProtectedRoute><AssistentePage /></ProtectedRoute>} />
            <Route path="/opme" element={<ProtectedRoute><OpmePage /></ProtectedRoute>} />
            <Route path="/compras" element={<ProtectedRoute><ComprasPage /></ProtectedRoute>} />
            <Route path="/cotacao-publica/:token" element={<PublicQuotationPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </ContractsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
