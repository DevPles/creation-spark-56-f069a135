import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import prsLogo from "@/assets/prs-logo.png";

const ORB_COUNT = 8;
const generateOrb = (id: number) => ({
  id, x: Math.random() * 100, y: Math.random() * 100,
  size: 150 + Math.random() * 300, duration: 8 + Math.random() * 10, delay: Math.random() * 2,
});

const OrbBackground = () => {
  const [orbs, setOrbs] = useState(() => Array.from({ length: ORB_COUNT }, (_, i) => generateOrb(i)));
  useEffect(() => {
    const interval = setInterval(() => {
      setOrbs((prev) => prev.map((orb) => (Math.random() > 0.5 ? generateOrb(orb.id) : orb)));
    }, 4000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden z-0">
      <AnimatePresence mode="popLayout">
        {orbs.map((orb) => (
          <motion.div
            key={`${orb.id}-${orb.x.toFixed(1)}`}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 0.4, scale: 1 }}
            exit={{ opacity: 0, scale: 0.3 }}
            transition={{ duration: orb.duration / 2, delay: orb.delay, ease: "easeInOut" }}
            className="absolute rounded-full"
            style={{
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              width: orb.size,
              height: orb.size,
              background: `radial-gradient(circle, hsl(200 70% 65% / 0.35) 0%, hsl(214 60% 45% / 0.15) 50%, transparent 70%)`,
              filter: "blur(40px)",
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

const METRICS = [
  "Taxa Ocupação = 847/960 = 88,2%",
  "Custo por Atendimento = R$52.400/1.284 = R$40,81",
  "Cobertura Vacinal = 1.024/1.047 = 97,8%",
  "Tempo Médio Permanência = 4.230/960 = 4,4 dias",
  "Execução Orçamentária = R$48.900/R$52.400 = 93,3%",
  "Desvio Padrão = √(Σ(xᵢ-μ)²/12) = 3,72",
  "Atingimento Médio = (92+87+94)/3 = 91%",
  "Adesão ao Tratamento = 219/232 = 94,4%",
  "ROI = (R$148.700-R$52.400)/R$52.400 = 1,84",
  "NPV = Σ CFₜ/(1+0,08)ᵗ = R$142.300",
  "Escore Z = (88,2-85)/3,72 = 0,86",
  "Taxa Infecção = 62/1.000 = 6,2%",
];

const TypewriterText = ({ text }: { text: string }) => {
  const [charIndex, setCharIndex] = useState(0);
  useEffect(() => { setCharIndex(0); }, [text]);
  useEffect(() => {
    if (charIndex < text.length) {
      const t = setTimeout(() => setCharIndex(v => v + 1), 45);
      return () => clearTimeout(t);
    }
  }, [charIndex, text.length]);
  return (
    <>
      {text.slice(0, charIndex)}
      {charIndex < text.length && <span className="animate-pulse">|</span>}
    </>
  );
};

const GeoShapes = () => {
  const [items, setItems] = useState<{ id: string; text: string; x: number; y: number }[]>([]);

  useEffect(() => {
    const t = setInterval(() => {
      setItems(prev => [
        ...prev.slice(-3),
        {
          id: crypto.randomUUID(),
          text: METRICS[Math.floor(Math.random() * METRICS.length)],
          x: 6 + Math.random() * 80,
          y: 8 + Math.random() * 78,
        },
      ]);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {items.map(item => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute select-none font-mono whitespace-nowrap"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              fontSize: 12,
              color: "rgba(255,255,255,0.8)",
              textShadow: "0 0 6px rgba(255,255,255,0.1)",
            }}
          >
            <TypewriterText text={item.text} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const Login = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => { if (session) navigate("/dashboard"); }, [session, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message); else navigate("/dashboard");
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Informe seu nome completo"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
    else toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) toast.error(error.message); else setResetSent(true);
    setLoading(false);
  };

  const isLogin = mode === "login";

  // Neumorphic input style
  const inputClass = "h-12 rounded-full bg-[hsl(220_15%_92%)] border-none shadow-[inset_2px_2px_5px_hsl(220_15%_82%),inset_-2px_-2px_5px_hsl(0_0%_100%)] placeholder:text-muted-foreground/60 px-5 text-sm focus-visible:ring-2 focus-visible:ring-primary/30";
  const neumorphBtn = "h-12 rounded-full font-semibold text-sm shadow-[inset_2px_2px_5px_rgba(0,0,0,0.25),inset_-2px_-2px_5px_rgba(255,255,255,0.08)] hover:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.3),inset_-3px_-3px_7px_rgba(255,255,255,0.1)] transition-all duration-200";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ background: "linear-gradient(135deg, hsl(214 55% 18%) 0%, hsl(214 55% 30%) 50%, hsl(214 45% 22%) 100%)" }}>
      <OrbBackground />

      <motion.div layout transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative z-10 w-full max-w-[820px] min-h-[460px] rounded-2xl overflow-hidden flex" style={{ boxShadow: "0 25px 60px -15px rgba(0,0,0,0.4)" }}>

        {/* ── PAINEL BRANDING (azul degradê) ── */}
        <motion.div layout className="relative overflow-hidden flex flex-col items-center justify-end p-10 pb-24 text-center" style={{ background: "linear-gradient(160deg, hsl(214 55% 30%) 0%, hsl(200 45% 35%) 100%)", order: isLogin ? 1 : 0, width: "45%", minWidth: 0 }}>

          {/* Geometric shapes that appear/disappear randomly */}
          <GeoShapes />
          <div className="relative z-10 space-y-4">
            
            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.div key="login-info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  <p className="text-lg font-semibold text-white/90">Novo por aqui?</p>
                  <button onClick={() => setMode("register")} className={`${neumorphBtn} px-8 bg-primary/80 text-white border border-white/20 hover:bg-primary`}>Cadastrar</button>
                </motion.div>
              ) : (
                <motion.div key="register-info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  <p className="text-lg font-semibold text-white/90">Bem-vindo!</p>
                  
                  <button onClick={() => setMode("login")} className={`${neumorphBtn} px-8 bg-primary/80 text-white border border-white/20 hover:bg-primary`}>Entrar</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── PAINEL FORMULÁRIO (neumorphic branco) ── */}
        <motion.div layout className="flex-1 bg-[hsl(220_15%_94%)] flex items-center justify-center p-10" style={{ order: isLogin ? 0 : 1 }}>
          <AnimatePresence mode="wait">
            {showReset ? (
              <motion.div key="reset" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-xs space-y-5">
                <h3 className="text-xl font-bold text-foreground text-center">Recuperar Senha</h3>
                {!resetSent ? (
                  <form onSubmit={handleReset} className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">Informe seu e-mail para receber o link de redefinição.</p>
                    <Input type="email" placeholder="E-mail" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className={inputClass} />
                    <button type="submit" disabled={loading} className={`${neumorphBtn} w-full bg-primary text-primary-foreground`}>{loading ? "Enviando..." : "Enviar link"}</button>
                  </form>
                ) : (
                  <div className="bg-accent/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-foreground font-medium">Se o e-mail estiver cadastrado, você receberá um link em instantes.</p>
                  </div>
                )}
                <button onClick={() => { setShowReset(false); setResetSent(false); }} className="w-full text-sm text-muted-foreground hover:text-primary transition-colors text-center">Voltar ao login</button>
              </motion.div>
            ) : isLogin ? (
              <motion.div key="login-form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="w-full max-w-xs space-y-5">
                <h2 className="text-4xl font-extrabold text-primary text-center tracking-tight drop-shadow-[0_2px_6px_rgba(59,130,246,0.3)]">MOSS</h2>
                <h3 className="text-sm text-muted-foreground text-center">Métricas para Organizações de Serviço Social</h3>
                <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
                  <Input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="off" name="moss-user" />
                  <div className="relative">
                    <Input type={showPw ? "text" : "password"} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-12`} autoComplete="new-password" name="moss-pw" />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button type="submit" disabled={loading} className={`${neumorphBtn} w-full bg-[hsl(220_15%_94%)] text-foreground`}>{loading ? "Entrando..." : "Entrar"}</button>
                </form>
                <div className="flex items-center justify-center gap-4 w-full">
                  <button onClick={() => setShowReset(true)} className="text-xs text-muted-foreground hover:text-primary transition-colors">Esqueci minha senha</button>
                  <span className="text-muted-foreground/30">|</span>
                  <button onClick={() => navigate("/opme-app")} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider">Acesso OPME</button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="register-form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-xs space-y-5">
                <h3 className="text-xl font-bold text-foreground text-center">Criar Conta</h3>
                <form onSubmit={handleRegister} className="space-y-4">
                  <Input type="text" placeholder="Seu nome completo" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                  <Input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                  <div className="relative">
                    <Input type={showPw ? "text" : "password"} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-12`} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button type="submit" disabled={loading} className={`${neumorphBtn} w-full bg-[hsl(220_15%_94%)] text-foreground`}>{loading ? "Criando..." : "Solicitar Acesso"}</button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
      <a
        href="https://periclesribeiro.com"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 text-xs text-white/80 drop-shadow-md hover:text-white transition-colors"
      >
        <span>Desenvolvido por</span>
        <img src={prsLogo} alt="PRS" className="h-5 w-auto object-contain" />
      </a>
    </div>
  );
};

export default Login;
