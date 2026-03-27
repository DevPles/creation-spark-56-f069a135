import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MetasPage from "./pages/MetasPage";
import ContratosPage from "./pages/ContratosPage";
import RiscoPage from "./pages/RiscoPage";
import AdminPage from "./pages/AdminPage";
import EvidenciasPage from "./pages/EvidenciasPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import LancamentoMetasPage from "./pages/LancamentoMetasPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/metas" element={<ProtectedRoute><MetasPage /></ProtectedRoute>} />
            <Route path="/contratos" element={<ProtectedRoute><ContratosPage /></ProtectedRoute>} />
            <Route path="/risco" element={<ProtectedRoute><RiscoPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/evidencias" element={<ProtectedRoute><EvidenciasPage /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><RelatoriosPage /></ProtectedRoute>} />
            <Route path="/lancamento" element={<ProtectedRoute><LancamentoMetasPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
