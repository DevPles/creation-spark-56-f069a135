import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const ORB_COUNT = 6;
const generateOrb = (id: number) => ({
  id, x: Math.random() * 100, y: Math.random() * 100,
  size: 100 + Math.random() * 220, duration: 6 + Math.random() * 8, delay: Math.random() * 3,
});

const OrbBackground = () => {
  const [orbs, setOrbs] = useState(() => Array.from({ length: ORB_COUNT }, (_, i) => generateOrb(i)));
  useEffect(() => {
    const interval = setInterval(() => {
      setOrbs((prev) => prev.map((orb) => (Math.random() > 0.65 ? generateOrb(orb.id) : orb)));
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence mode="popLayout">
        {orbs.map((orb) => (
          <motion.div key={`${orb.id}-${orb.x.toFixed(1)}`} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 0.18, scale: 1 }} exit={{ opacity: 0, scale: 0.3 }} transition={{ duration: orb.duration / 2, delay: orb.delay, ease: "easeInOut" }} className="absolute rounded-full" style={{ left: `${orb.x}%`, top: `${orb.y}%`, width: orb.size, height: orb.size, background: `radial-gradient(circle, hsl(214 60% 55% / 0.45) 0%, transparent 70%)`, filter: "blur(50px)", transform: "translate(-50%, -50%)" }} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const SHAPES = ["circle", "square", "triangle", "hexagon", "diamond"] as const;
type Shape = typeof SHAPES[number];

const shapeStyle = (shape: Shape, size: number): React.CSSProperties => {
  const base: React.CSSProperties = { width: size, height: size, position: "absolute" as const };
  switch (shape) {
    case "circle": return { ...base, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.15)" };
    case "square": return { ...base, borderRadius: 4, border: "1.5px solid rgba(255,255,255,0.12)" };
    case "triangle": return { ...base, width: 0, height: 0, borderLeft: `${size/2}px solid transparent`, borderRight: `${size/2}px solid transparent`, borderBottom: `${size}px solid rgba(255,255,255,0.1)`, background: "none" };
    case "hexagon": return { ...base, borderRadius: "25%", border: "1.5px solid rgba(255,255,255,0.12)", transform: "rotate(30deg)" };
    case "diamond": return { ...base, border: "1.5px solid rgba(255,255,255,0.12)", transform: "rotate(45deg)", borderRadius: 3 };
  }
};

const randomShape = (id: number) => ({
  id, shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
  x: 5 + Math.random() * 85, y: 5 + Math.random() * 85,
  size: 14 + Math.random() * 36, rotation: Math.random() * 360,
});

const GeoShapes = () => {
  const [shapes, setShapes] = useState(() => Array.from({ length: 10 }, (_, i) => randomShape(i)));

  useEffect(() => {
    const interval = setInterval(() => {
      setShapes(prev => prev.map(s => Math.random() > 0.6 ? randomShape(s.id) : s));
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence mode="popLayout">
        {shapes.map(s => (
          <motion.div
            key={`${s.id}-${s.x.toFixed(1)}-${s.y.toFixed(1)}`}
            initial={{ opacity: 0, scale: 0, rotate: 0 }}
            animate={{ opacity: 1, scale: 1, rotate: s.rotation }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            style={{ ...shapeStyle(s.shape, s.size), left: `${s.x}%`, top: `${s.y}%` }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};


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
        <motion.div layout className="relative overflow-hidden flex flex-col items-center justify-center p-10 text-center" style={{ background: "linear-gradient(160deg, hsl(214 55% 30%) 0%, hsl(200 45% 35%) 100%)", order: isLogin ? 1 : 0, width: "45%", minWidth: 0 }}>
          {/* Geometric shapes that appear/disappear randomly */}
          <GeoShapes />
          <div className="relative z-10 space-y-4">
            <h2 className="font-display text-4xl font-bold text-white tracking-tight">Moss</h2>
            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.div key="login-info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  <p className="text-lg font-semibold text-white/90">Novo por aqui?</p>
                  <p className="text-sm text-white/70 max-w-[240px] mx-auto">Sistema inteligente de análise de métricas para Organizações Sociais de Saúde.</p>
                  <button onClick={() => setMode("register")} className={`${neumorphBtn} px-8 bg-primary/80 text-white border border-white/20 hover:bg-primary`}>Cadastrar</button>
                </motion.div>
              ) : (
                <motion.div key="register-info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  <p className="text-lg font-semibold text-white/90">Bem-vindo!</p>
                  <p className="text-sm text-white/70 max-w-[240px] mx-auto">Sistema inteligente de análise de métricas para Organizações Sociais de Saúde.</p>
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
                <h3 className="text-xl font-bold text-foreground text-center">Moss Login</h3>
                <form onSubmit={handleLogin} className="space-y-4">
                  <Input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                  <div className="relative">
                    <Input type={showPw ? "text" : "password"} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-12`} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button type="submit" disabled={loading} className={`${neumorphBtn} w-full bg-[hsl(220_15%_94%)] text-foreground`}>{loading ? "Entrando..." : "Sign In"}</button>
                </form>
                <button onClick={() => setShowReset(true)} className="w-full text-sm text-muted-foreground hover:text-primary transition-colors text-center">Esqueci minha senha</button>
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
    </div>
  );
};

export default Login;
