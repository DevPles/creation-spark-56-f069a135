interface KpiCardProps {
  label: string;
  value: string;
  status: "critical" | "warning" | "success";
  subtitle: string;
}

const statusColors = {
  critical: "border-l-risk",
  warning: "border-l-warning",
  success: "border-l-success",
};

const KpiCard = ({ label, value, status, subtitle }: KpiCardProps) => (
  <div className={`kpi-card border-l-4 ${statusColors[status]}`}>
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
    <p className="kpi-value mt-1">{value}</p>
    <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
  </div>
);

export default KpiCard;
