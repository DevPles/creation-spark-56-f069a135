interface KpiCardProps {
  label: string;
  value: string;
  status: "critical" | "warning" | "success";
  subtitle: string;
}

const KpiCard = ({ label, value, subtitle }: KpiCardProps) => {
  return (
    <div className="kpi-card">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="kpi-value mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
};

export default KpiCard;
