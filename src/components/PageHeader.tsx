import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERIODS = [
  { key: "S", label: "Semana" },
  { key: "M", label: "Mês" },
  { key: "Q", label: "Trimestre" },
  { key: "4M", label: "Quadrimestre" },
  { key: "Y", label: "Anual" },
];
const UNITS = ["Todas as unidades", "Hospital Geral", "UPA Norte", "UBS Centro"];

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  period?: string;
  onPeriodChange?: (v: string) => void;
  selectedUnit?: string;
  onUnitChange?: (v: string) => void;
  action?: React.ReactNode;
}

const PageHeader = ({ title, subtitle, period, onPeriodChange, selectedUnit, onUnitChange, action }: PageHeaderProps) => (
  <div className="flex flex-col gap-3 mb-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="font-display text-lg sm:text-xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {(period || selectedUnit) && (
      <div className="flex flex-wrap items-center gap-2">
        {period && onPeriodChange && (
          <Select value={period} onValueChange={onPeriodChange}>
            <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedUnit && onUnitChange && (
          <Select value={selectedUnit} onValueChange={onUnitChange}>
            <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    )}
  </div>
);

export { PERIODS, UNITS };
export default PageHeader;
