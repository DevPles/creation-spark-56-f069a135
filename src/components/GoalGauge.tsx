interface GoalGaugeProps {
  percent: number; // 0-100+
  size?: number;
}

const GoalGauge = ({ percent, size = 100 }: GoalGaugeProps) => {
  const clampedPct = Math.min(100, Math.max(0, percent));
  const radius = 38;
  const cx = 50;
  const cy = 55;
  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle; // 240°

  const polarToCartesian = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const describeArc = (start: number, end: number) => {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = Math.abs(end - start) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const valueAngle = startAngle + (clampedPct / 100) * totalAngle;
  const color =
    percent >= 90 ? "hsl(142 71% 45%)" : percent >= 70 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))";

  return (
    <svg viewBox="0 0 100 70" width={size} height={size * 0.7} className="mx-auto">
      {/* Background arc */}
      <path d={describeArc(startAngle, endAngle)} fill="none" stroke="hsl(var(--muted))" strokeWidth={7} strokeLinecap="round" />
      {/* Value arc */}
      {clampedPct > 0 && (
        <path d={describeArc(startAngle, valueAngle)} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" />
      )}
      {/* Center text */}
      <text x={cx} y={cy - 2} textAnchor="middle" className="font-display" fontSize={16} fontWeight={700} fill={color}>
        {Math.round(percent)}%
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={7} fill="hsl(var(--muted-foreground))">
        atingimento
      </text>
    </svg>
  );
};

export default GoalGauge;
