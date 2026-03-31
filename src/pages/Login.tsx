import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ORB_COUNT = 8;

const generateOrb = (id: number) => ({
  id,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 80 + Math.random() * 200,
  duration: 6 + Math.random() * 8,
  delay: Math.random() * 4,
});

const OrbBackground = () => {
  const [orbs, setOrbs] = useState(() =>
    Array.from({ length: ORB_COUNT }, (_, i) => generateOrb(i))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setOrbs((prev) =>
        prev.map((orb) =>
          Math.random() > 0.7 ? generateOrb(orb.id) : orb
        )
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence mode="popLayout">
        {orbs.map((orb) => (
          <motion.div
            key={`${orb.id}-${orb.x.toFixed(2)}-${orb.y.toFixed(2)}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.15, scale: 1 }}
            exit={{ opacity: 0, scale: 0.3 }}
            transition={{
              duration: orb.duration / 2,
              delay: orb.delay,
              ease: "easeInOut",
            }}
            className="absolute rounded-full"
            style={{
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              width: orb.size,
              height: orb.size,
              background: `radial-gradient(circle, hsl(214 60% 55% / 0.4) 0%, hsl(214 55% 30% / 0) 70%)`,
              filter: "blur(40px)",
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

const Login = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (session) navigate("/dashboard");
  }, [session, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else setResetSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative"
      style={{
        background: "linear-gradient(135deg, hsl(214 55% 18%) 0%, hsl(214 55% 30%) 50%, hsl(214 45% 22%) 100%)",
      }}>
      <OrbBackground />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm bg-card rounded-xl p-8 shadow-2xl shadow-black/30 relative z-10"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-primary-foreground font-display font-bold text-lg">M</span>
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">Moss</h1>
          <p className="text-sm text-muted-foreground mt-1">Plataforma de gestão de indicadores</p>
        </div>

        {!showReset ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.gov.br" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
            <button type="button" onClick={() => setShowReset(true)} className="w-full text-sm text-muted-foreground hover:text-primary transition-colors">Esqueci minha senha</button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {!resetSent ? (
              <>
                <p className="text-sm text-muted-foreground">Informe seu e-mail para receber o link de redefinição de senha.</p>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">E-mail</Label>
                  <Input id="reset-email" type="email" placeholder="seu@email.gov.br" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="h-11" />
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>{loading ? "Enviando..." : "Enviar link"}</Button>
              </>
            ) : (
              <div className="bg-accent/50 rounded-lg p-4 text-center">
                <p className="text-sm text-foreground font-medium">Se o e-mail estiver cadastrado, você receberá um link de redefinição em instantes.</p>
              </div>
            )}
            <button type="button" onClick={() => { setShowReset(false); setResetSent(false); }} className="w-full text-sm text-muted-foreground hover:text-primary transition-colors">Voltar ao login</button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default Login;
