interface KpiCardProps {
  label: string;
  value: string;
  status: "critical" | "warning" | "success";
  subtitle: string;
}

const KpiCard = ({ label, value, status, subtitle }: KpiCardProps) => {
  const statusColor = status === "critical" ? "border-l-destructive" : status === "warning" ? "border-l-warning" : "border-l-success";
  return (
    <div className={`kpi-card border-l-4 ${statusColor}`}>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="kpi-value mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
};

export default KpiCard;
