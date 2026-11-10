import type { ReactNode } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  ChevronRight,
  CircleHelp,
  LoaderCircle,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { ApiErrorNotification, AppNotification } from "@/lib/api";

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

export function Toast({
  message,
  type = "success",
}: {
  message: string;
  type?: "technical" | "payment" | "success" | "info";
}) {
  const Icon = type === "payment" ? AlertTriangle : type === "info" || type === "technical" ? CircleHelp : Check;
  return (
    <div className={`toast ${type}`} role="status" aria-live="polite">
      <span className="health-icon" style={{ width: 23, height: 23 }}>
        <Icon size={13} aria-hidden="true" />
      </span>
      {message}
    </div>
  );
}

export function WelcomeManualDialog({
  onClose,
  onStartTour,
}: {
  onClose: () => void;
  onStartTour: () => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="welcome-backdrop">
      <section
        className="welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        aria-describedby="welcome-description"
      >
        <button className="welcome-close" type="button" onClick={onClose} aria-label="Close guide">
          <X size={18} />
        </button>
        <span className="welcome-icon"><CircleHelp size={22} /></span>
        <div className="eyebrow">A quick tour</div>
        <h2 id="welcome-title">Welcome to AgentGuard</h2>
        <p id="welcome-description">
          AgentGuard helps you review and control purchases made by AI shopping agents.
        </p>
        <div className="welcome-guide-list">
          <div><strong>Agent</strong><span>Your AI shopper. Try a sample request to see how a purchase is checked.</span></div>
          <div><strong>Approvals</strong><span>Held orders that need you to review and approve or decline.</span></div>
          <div><strong>Rules</strong><span>Your guardrails, including budgets and the kinds of purchases allowed.</span></div>
          <div><strong>Audit</strong><span>Receipts and a history of purchase decisions.</span></div>
        </div>
        <div className="welcome-tip">
          <BookOpenCheck size={16} />
          <span>Run a test transaction in Agent to watch the dashboard, approvals, and receipts update.</span>
        </div>
        <button className="button button-primary welcome-done" type="button" onClick={onClose}>
          Get started
        </button>
        <button className="button button-quiet welcome-tour-start" type="button" onClick={onStartTour}>
          Take the guided tour <ChevronRight size={14} />
        </button>
      </section>
    </div>
  );
}

const TOUR_STEPS = [
  {
    target: "agent",
    title: "Your AI shopper",
    copy: "Open the Agent playground to submit a test purchase request and see how it is checked.",
  },
  {
    target: "approvals",
    title: "Review held orders",
    copy: "Orders that need your decision appear in Approvals. Review the details before approving or declining.",
  },
  {
    target: "rules",
    title: "Set your guardrails",
    copy: "Rules let you set budgets and choose which purchases your agents can make.",
  },
  {
    target: "audit",
    title: "Find receipts and history",
    copy: "Audit keeps a record of purchase decisions and their receipts.",
  },
];

export function TourSpotlight({
  step,
  onNext,
  onClose,
}: {
  step: number;
  onNext: () => void;
  onClose: () => void;
}) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const current = TOUR_STEPS[step];

  useEffect(() => {
    if (!current) return;

    function updateTarget() {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-tour="${current.target}"]`),
      );
      const target = candidates.find((candidate) => {
        const style = window.getComputedStyle(candidate);
        return style.display !== "none" && style.visibility !== "hidden" && candidate.getClientRects().length > 0;
      });
      if (!target) {
        setTargetRect(null);
        return;
      }

      target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      setTargetRect(target.getBoundingClientRect());
    }

    updateTarget();
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [current]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (!current) return null;

  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const tooltipLeft = targetRect
    ? Math.max(16, Math.min(targetRect.left, viewportWidth - 360))
    : Math.max(16, viewportWidth / 2 - 160);
  const tooltipTop = targetRect
    ? Math.min(targetRect.bottom + 16, viewportHeight - 190)
    : Math.max(24, viewportHeight / 3);

  return (
    <div className="tour-backdrop" aria-live="polite">
      {targetRect && (
        <div
          className="tour-spotlight"
          style={{
            left: targetRect.left - 7,
            top: targetRect.top - 7,
            width: targetRect.width + 14,
            height: targetRect.height + 14,
          }}
          aria-hidden="true"
        />
      )}
      <section
        className="tour-tooltip"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        style={{ left: tooltipLeft, top: tooltipTop }}
      >
        <button className="welcome-close tour-close" type="button" onClick={onClose} aria-label="End guided tour">
          <X size={17} />
        </button>
        <div className="tour-step-label">STEP {step + 1} OF {TOUR_STEPS.length}</div>
        <h2 id="tour-title">{current.title}</h2>
        <p>{current.copy}</p>
        <div className="tour-tooltip-footer">
          <button className="button button-quiet" type="button" onClick={onClose}>Skip tour</button>
          <button className="button button-primary" type="button" onClick={onNext}>
            {step === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
            {step < TOUR_STEPS.length - 1 && <ChevronRight size={14} />}
          </button>
        </div>
      </section>
    </div>
  );
}

export function NotificationsPanel({
  notifications,
  onRead,
  onClose,
}: {
  notifications: AppNotification[];
  onRead: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <section className="notifications-panel" aria-label="Notifications">
      <div className="notifications-panel-heading">
        <strong>Notifications</strong>
        <button className="welcome-close" type="button" onClick={onClose} aria-label="Close notifications">
          <X size={16} />
        </button>
      </div>
      {notifications.length ? (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <button
              className={`notification-item ${notification.type}${notification.read ? " read" : ""}`}
              key={notification.id}
              type="button"
              onClick={() => onRead(notification.id)}
            >
              <span className="notification-item-dot" aria-hidden="true" />
              <span className="notification-item-copy">
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                <small>{new Date(notification.createdAt).toLocaleString()}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="notifications-empty">No notifications yet. Purchase decisions and updates will appear here.</p>
      )}
    </section>
  );
}

export function ProfileFlyout({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <section className="profile-flyout" aria-label="Morgan Chen account details">
      <div className="profile-flyout-header">
        <div className="profile-avatar">MC</div>
        <div>
          <strong>Morgan Chen</strong>
          <span>Personal Account</span>
        </div>
        <button className="welcome-close" type="button" onClick={onClose} aria-label="Close profile">
          <X size={16} />
        </button>
      </div>
      <div className="profile-flyout-detail">
        <span>Account tier</span>
        <strong>Personal Account (PayPal AgentGuard Connected)</strong>
      </div>
      <div className="profile-flyout-detail">
        <span>Guardrail status</span>
        <strong className="profile-guardrail-status"><span /> Active</strong>
      </div>
      <div className="profile-flyout-detail">
        <span>Monthly budget</span>
        <strong>$1,000.00</strong>
      </div>
    </section>
  );
}

export function BackendErrorDialog({
  error,
  remainingSeconds,
  technicalExpanded,
  onMinimize,
  onClose,
  onRetry,
}: {
  error: ApiErrorNotification | null;
  remainingSeconds: number;
  technicalExpanded: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onRetry: () => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);

  if (!error) return null;

  async function retryRequest() {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  const retryButton = (
    <button
      className="button button-primary error-dialog-retry"
      type="button"
      onClick={() => void retryRequest()}
      disabled={retrying}
    >
      {retrying && <LoaderCircle className="error-dialog-spinner" size={14} />}
      {retrying ? "Retrying…" : "Retry"}
    </button>
  );

  if (error.kind === "technical" && !technicalExpanded) {
    const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
    const seconds = (remainingSeconds % 60).toString().padStart(2, "0");

    return (
      <aside className="technical-error-banner" role="status" aria-live="polite">
        <span className="error-dialog-icon"><AlertTriangle size={18} /></span>
        <div className="technical-error-copy">
          <strong>{error.title}</strong>
          <span>{error.message}</span>
          <small>Repeat infrastructure alerts suppressed for {minutes}:{seconds}</small>
        </div>
        {retryButton}
        <button className="error-dialog-close" type="button" onClick={onClose} aria-label="Dismiss technical error">
          <X size={17} />
        </button>
      </aside>
    );
  }

  return (
    <div
      className={`error-dialog-backdrop${error.kind === "technical" ? " technical-error-backdrop" : ""}`}
      onClick={error.kind === "technical" ? onMinimize : undefined}
    >
      <section
        className={`error-dialog ${error.kind}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="backend-error-title"
        aria-describedby="backend-error-message"
        onClick={(event) => event.stopPropagation()}
      >
        {error.kind === "technical" ? (
          <button className="error-dialog-close" type="button" onClick={onMinimize} aria-label="Continue working">
            <X size={17} />
          </button>
        ) : (
          <button className="error-dialog-close" type="button" onClick={onClose} aria-label="Close error">
            <X size={17} />
          </button>
        )}
        <span className="error-dialog-icon"><AlertTriangle size={21} /></span>
        <h2 id="backend-error-title">{error.title}</h2>
        <p id="backend-error-message">{error.message}</p>
        {error.kind === "technical" && (
          <div className="technical-dialog-actions">
            <small>Retry window: {Math.floor(remainingSeconds / 60).toString().padStart(2, "0")}:{(remainingSeconds % 60).toString().padStart(2, "0")}</small>
            <button className="button button-quiet" type="button" onClick={onMinimize}>Continue working</button>
          </div>
        )}
        {retryButton}
      </section>
    </div>
  );
}
