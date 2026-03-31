import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2, Pause, Play, ChevronLeft, ChevronRight } from "lucide-react";

interface SlideData {
  title: string;
  subtitle: string;
  cards: { label: string; value: string; color: string }[];
  goals?: { name: string; attainment: number; risk: number }[];
}

interface FullscreenDashboardProps {
  slides: SlideData[];
}

const FullscreenDashboard = ({ slides }: FullscreenDashboardProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const handleFullscreenChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  useEffect(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [handleFullscreenChange]);

  useEffect(() => {
    if (!isPlaying || !isFullscreen) return;
    const t = setInterval(() => {
      setActiveSlide((s) => (s + 1) % slides.length);
    }, 8000);
    return () => clearInterval(t);
  }, [isPlaying, isFullscreen, slides.length]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setActiveSlide((s) => (s + 1) % slides.length);
      } else if (e.key === "ArrowLeft") {
        setActiveSlide((s) => (s - 1 + slides.length) % slides.length);
      } else if (e.key === "Escape") {
        document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen, slides.length]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  };

  const slide = slides[activeSlide];

  if (!isFullscreen) {
    return (
      <button
        onClick={toggleFullscreen}
        className="kpi-card flex items-center gap-2 cursor-pointer group"
      >
        <Maximize2 size={18} className="text-primary" />
        <div className="text-left">
          <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">
            Tela Cheia
          </h3>
          <p className="text-sm text-muted-foreground">
            Apresentação automática dos indicadores
          </p>
        </div>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-background flex flex-col"
    >
      {/* Top bar with dots and controls */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveSlide(i)}
              className={`h-3 rounded-full transition-all duration-300 ${
                i === activeSlide
                  ? "w-8 bg-primary"
                  : "w-3 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
          <span className="text-sm text-muted-foreground ml-2">
            {activeSlide + 1}/{slides.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            onClick={() =>
              setActiveSlide((s) => (s - 1 + slides.length) % slides.length)
            }
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setActiveSlide((s) => (s + 1) % slides.length)}
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Minimize2 size={18} />
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="flex-1 px-8 pb-8 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4 }}
            className="h-full flex flex-col"
          >
            {/* Title */}
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {slide.title}
              </h1>
              <p className="text-sm text-muted-foreground">{slide.subtitle}</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {slide.cards.map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="kpi-card"
                >
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p
                    className="font-display text-2xl font-bold mt-1"
                    style={{ color: card.color }}
                  >
                    {card.value}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Goals table if available */}
            {slide.goals && (
              <div className="flex-1 kpi-card overflow-auto">
                <div className="grid grid-cols-12 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                  <span className="col-span-6">Meta</span>
                  <span className="col-span-3 text-right">Atingimento</span>
                  <span className="col-span-3 text-right">R$ risco</span>
                </div>
                {slide.goals.map((goal, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="grid grid-cols-12 px-3 py-3 text-sm items-center border-b border-border last:border-0"
                  >
                    <span className="col-span-6 text-foreground">
                      {goal.name}
                    </span>
                    <span className="col-span-3 text-right">
                      <span
                        className={`status-badge ${
                          goal.attainment >= 90
                            ? "status-success"
                            : goal.attainment >= 70
                            ? "status-warning"
                            : "status-critical"
                        }`}
                      >
                        {goal.attainment}%
                      </span>
                    </span>
                    <span className="col-span-3 text-right font-display font-semibold text-risk">
                      {goal.risk > 0
                        ? `R$ ${(goal.risk / 1000).toFixed(1)}k`
                        : "—"}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      {isPlaying && (
        <div className="h-1 bg-muted">
          <motion.div
            key={activeSlide}
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 8, ease: "linear" }}
          />
        </div>
      )}
    </div>
  );
};

// Attach ref for fullscreen
const FullscreenDashboardWrapper = ({ slides }: FullscreenDashboardProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const enterFullscreen = () => containerRef.current?.requestFullscreen();

  if (!isFullscreen) {
    return (
      <button
        onClick={enterFullscreen}
        className="kpi-card flex items-center gap-3 cursor-pointer group w-full text-left"
      >
        <Maximize2 size={20} className="text-primary shrink-0" />
        <div>
          <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">
            Tela Cheia
          </h3>
          <p className="text-sm text-muted-foreground">
            Apresentação automática dos indicadores
          </p>
        </div>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-[9999]">
      <FullscreenContent slides={slides} />
    </div>
  );
};

const FullscreenContent = ({ slides }: { slides: SlideData[] }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => setActiveSlide((s) => (s + 1) % slides.length), 8000);
    return () => clearInterval(t);
  }, [isPlaying, slides.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setActiveSlide((s) => (s + 1) % slides.length);
      } else if (e.key === "ArrowLeft") {
        setActiveSlide((s) => (s - 1 + slides.length) % slides.length);
      } else if (e.key === "Escape") {
        document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [slides.length]);

  const slide = slides[activeSlide];

  return (
    <div className="h-full w-full bg-background flex flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setActiveSlide(i)}
              className={`h-3 rounded-full transition-all duration-300 ${i === activeSlide ? "w-8 bg-primary" : "w-3 bg-muted-foreground/30"}`}
            />
          ))}
          <span className="text-sm text-muted-foreground ml-2">{activeSlide + 1}/{slides.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 rounded-full hover:bg-muted text-muted-foreground">
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button onClick={() => setActiveSlide((s) => (s - 1 + slides.length) % slides.length)} className="p-2 rounded-full hover:bg-muted text-muted-foreground">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setActiveSlide((s) => (s + 1) % slides.length)} className="p-2 rounded-full hover:bg-muted text-muted-foreground">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => document.exitFullscreen()} className="p-2 rounded-full hover:bg-muted text-muted-foreground">
            <Minimize2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 px-8 pb-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={activeSlide} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.4 }} className="h-full flex flex-col">
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold text-foreground">{slide.title}</h1>
              <p className="text-sm text-muted-foreground">{slide.subtitle}</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {slide.cards.map((card, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="kpi-card">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="font-display text-2xl font-bold mt-1" style={{ color: card.color }}>{card.value}</p>
                </motion.div>
              ))}
            </div>

            {slide.goals && (
              <div className="flex-1 kpi-card overflow-auto">
                <div className="grid grid-cols-12 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                  <span className="col-span-6">Meta</span>
                  <span className="col-span-3 text-right">Atingimento</span>
                  <span className="col-span-3 text-right">R$ risco</span>
                </div>
                {slide.goals.map((goal, i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.05 }}
                    className="grid grid-cols-12 px-3 py-3 text-sm items-center border-b border-border last:border-0">
                    <span className="col-span-6 text-foreground">{goal.name}</span>
                    <span className="col-span-3 text-right">
                      <span className={`status-badge ${goal.attainment >= 90 ? "status-success" : goal.attainment >= 70 ? "status-warning" : "status-critical"}`}>{goal.attainment}%</span>
                    </span>
                    <span className="col-span-3 text-right font-display font-semibold text-risk">
                      {goal.risk > 0 ? `R$ ${(goal.risk / 1000).toFixed(1)}k` : "—"}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {isPlaying && (
        <div className="h-1 bg-muted">
          <motion.div key={activeSlide} className="h-full bg-primary" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 8, ease: "linear" }} />
        </div>
      )}
    </div>
  );
};

export default FullscreenDashboardWrapper;
export type { SlideData };
