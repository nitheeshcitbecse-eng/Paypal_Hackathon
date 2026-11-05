import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
  icon: Icon,
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "neutral" | "info";
  icon?: LucideIcon;
}) {
  return (
    <span className={`status-pill ${tone}`}>
      {Icon && <Icon size={12} strokeWidth={2.2} />}
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  foot,
  icon: Icon,
  positive = false,
}: {
  label: string;
  value: string;
  foot: string;
  icon: LucideIcon;
  positive?: boolean;
}) {
  return (
    <div className="card metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-icon">
        <Icon size={16} />
      </div>
      <div className="metric-value">{value}</div>
      <div className={`metric-foot${positive ? " positive" : ""}`}>{foot}</div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      className="toggle"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    />
  );
}

export function Toast({ message }: { message: string }) {
  return (
    <div className="toast" role="status">
      <span className="health-icon" style={{ width: 23, height: 23 }}>
        <Check size={13} aria-hidden="true" />
      </span>
      {message}
    </div>
  );
}
