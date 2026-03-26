import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        <div className="flex items-center justify-between h-14 gap-3">
          {/* Logo */}
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-xs">MC</span>
            </div>
            <span className="font-display font-semibold text-foreground text-sm hidden sm:block">
              Metas Contratuais
            </span>
          </button>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select value={activePeriod} onValueChange={onPeriodChange}>
              <SelectTrigger className="w-[150px] h-9 text-sm">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedUnit} onValueChange={onUnitChange}>
              <SelectTrigger className="w-[180px] h-9 text-sm hidden md:flex">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Profile */}
          <button
            onClick={() => navigate("/")}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
          >
            AS
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
