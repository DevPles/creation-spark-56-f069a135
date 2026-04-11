import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedRoute = ({ children, adminOnly, financialOnly }: { children: React.ReactNode; adminOnly?: boolean; financialOnly?: boolean }) => {
  const { session, loading, isAdmin, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;

  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;

  if (financialOnly && !isAdmin && role !== "gestor") return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;