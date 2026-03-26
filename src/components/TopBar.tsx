import { useNavigate } from "react-router-dom";

interface TopBarProps {
  periods: { key: string; label: string }[];
  activePeriod: string;
  onPeriodChange: (key: string) => void;
  units: string[];
  selectedUnit: string;
  onUnitChange: (unit: string) => void;
}

const TopBar = ({ periods, activePeriod, onPeriodChange, units, selectedUnit, onUnitChange }: TopBarProps) => {
  const navigate = useNavigate();

  return (
    <header className="topbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-xs">MC</span>
            </div>
            <span className="font-display font-semibold text-foreground text-sm hidden sm:block">
              Metas Contratuais
            </span>
          </button>

          {/* Period selector */}
          <div className="flex items-center gap-1">
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => onPeriodChange(p.key)}
                className={`period-chip ${activePeriod === p.key ? "period-chip-active" : "period-chip-inactive"}`}
              >
                <span className="hidden sm:inline">{p.label}</span>
                <span className="sm:hidden">{p.key}</span>
              </button>
            ))}
          </div>

          {/* Unit + Profile */}
          <div className="flex items-center gap-3">
            <select
              value={selectedUnit}
              onChange={(e) => onUnitChange(e.target.value)}
              className="hidden md:block text-sm bg-secondary text-foreground rounded-md px-3 py-1.5 border-0 focus:ring-1 focus:ring-ring"
            >
              {units.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>

            <button
              onClick={() => navigate("/")}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              AS
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
