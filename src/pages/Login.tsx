import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const UNITS = ["Hospital Geral", "UPA Norte", "UBS Centro"] as const;

const Login = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regUnit, setRegUnit] = useState<string>(UNITS[0]);
  const [regCargo, setRegCargo] = useState("");

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: { name: regName, facility_unit: regUnit, cargo: regCargo },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Conta criada! Verifique seu e-mail ou faça login.");
      setShowRegister(false);
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-primary-foreground font-display font-bold text-lg">SL</span>
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">SisLu</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistema de gestão e acompanhamento</p>
        </div>

        {showRegister ? (
          <form onSubmit={handleRegister} className="space-y-3">
            <p className="text-sm font-semibold text-foreground mb-2">Criar conta</p>
            <div className="space-y-1">
              <Label htmlFor="reg-name">Nome completo</Label>
              <Input id="reg-name" placeholder="Seu nome" value={regName} onChange={(e) => setRegName(e.target.value)} className="h-10" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reg-email">E-mail</Label>
              <Input id="reg-email" type="email" placeholder="seu@email.gov.br" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="h-10" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reg-password">Senha</Label>
              <Input id="reg-password" type="password" placeholder="••••••••" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="h-10" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reg-cargo">Cargo</Label>
              <Input id="reg-cargo" placeholder="Ex: Enfermeiro(a)" value={regCargo} onChange={(e) => setRegCargo(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reg-unit">Unidade</Label>
              <select id="reg-unit" value={regUnit} onChange={(e) => setRegUnit(e.target.value)} className="w-full h-10 text-sm border border-border rounded px-2 bg-background">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <Button type="submit" className="w-full h-10 font-semibold" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</Button>
            <button type="button" onClick={() => setShowRegister(false)} className="w-full text-sm text-muted-foreground hover:text-primary transition-colors">Voltar ao login</button>
          </form>
        ) : !showReset ? (
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
            <div className="flex justify-between">
              <button type="button" onClick={() => setShowReset(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors">Esqueci minha senha</button>
              <button type="button" onClick={() => setShowRegister(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors">Criar conta</button>
            </div>
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
