const CLASS_BY_STATUS: Record<string, string> = {
  healthy: 'health-badge--nominal',
  warning: 'health-badge--warning',
  critical: 'health-badge--critical',
};

interface HealthBadgeProps {
  status: string;
}

export function HealthBadge({ status }: HealthBadgeProps) {
  const variantClass = CLASS_BY_STATUS[status.toLowerCase()] ?? 'health-badge--unknown';
  return <span className={`health-badge ${variantClass}`}>{status}</span>;
}
