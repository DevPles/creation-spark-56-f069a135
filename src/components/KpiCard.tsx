interface KpiCardProps {
  label: string;
  value: string;
  status: "critical" | "warning" | "success";
  subtitle: string;
}

const KpiCard = ({ label, value, subtitle }: KpiCardProps) => {
  return (
    <div className="kpi-card">
      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium leading-tight">{label}</p>
      <p className="kpi-value mt-0.5 sm:mt-1">{value}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight">{subtitle}</p>
    </div>
  );
};

export default KpiCard;
