import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const FloatingTrainingHeart = () => {
  const navigate = useNavigate();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const didDrag = useRef(false);

  useEffect(() => {
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  }, []);

  return (
    <button
      type="button"
      onClick={() => { if (!didDrag.current) navigate("/assistente"); }}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        didDrag.current = false;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragRef.current) return;
        didDrag.current = true;
        setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy });
      }}
      onPointerUp={() => { dragRef.current = null; }}
      className="fixed z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg cursor-grab active:cursor-grabbing"
      style={{
        left: pos?.x,
        top: pos?.y,
        right: pos ? undefined : 24,
        bottom: pos ? undefined : 24,
        animation: "heartbeat 1.4s ease-in-out infinite",
      }}
      aria-label="Treinamento do sistema"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </button>
  );
};

export default FloatingTrainingHeart;
