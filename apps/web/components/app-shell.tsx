"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  BookOpenCheck,
  Bot,
  CircleHelp,
  LayoutDashboard,
  Moon,
  Shield,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ApiError,
  clearApiError,
  getAppNotificationsSnapshot,
  getServerAppNotificationsSnapshot,
  hydrateAppNotifications,
  markAppNotificationRead,
  subscribeToApiErrors,
  subscribeToAppNotificationStore,
  subscribeToAppNotifications,
  type ApiErrorNotification,
  type AppNotification,
} from "@/lib/api";
import {
  BackendErrorDialog,
  NotificationsPanel,
  ProfileFlyout,
  Toast,
  TourSpotlight,
  WelcomeManualDialog,
} from "@/components/ui";

const TECHNICAL_ERROR_SNOOZE_MS = 10 * 60 * 1000;
const TECHNICAL_ERROR_SNOOZE_KEY = "agentguard:technical-error-snoozed-until";
const WELCOME_STORAGE_KEY = "agentguard:welcome-seen";
let memoryTechnicalSnoozeUntil = 0;

function getTechnicalSnoozeUntil() {
  try {
    return Number(window.localStorage.getItem(TECHNICAL_ERROR_SNOOZE_KEY)) || memoryTechnicalSnoozeUntil;
  } catch {
    return memoryTechnicalSnoozeUntil;
  }
}

function setTechnicalSnoozeUntil(timestamp: number) {
  memoryTechnicalSnoozeUntil = timestamp;
  try {
    window.localStorage.setItem(TECHNICAL_ERROR_SNOOZE_KEY, String(timestamp));
  } catch {
    // The timer remains active in memory when browser storage is unavailable.
  }
}

function clearTechnicalSnooze() {
  memoryTechnicalSnoozeUntil = 0;
  try {
    window.localStorage.removeItem(TECHNICAL_ERROR_SNOOZE_KEY);
  } catch {
    // Storage may be unavailable in private browsing contexts.
  }
}

function loadNotifications() {
  try {
    const stored: unknown = JSON.parse(
      window.sessionStorage.getItem("agentguard:notifications") ?? "[]",
    );
    if (!Array.isArray(stored)) return [];
    return stored.filter(
      (item): item is AppNotification =>
        isAppNotification(item),
    );
  } catch {
    return [];
  }
}

function isAppNotification(item: unknown): item is AppNotification {
  if (!item || typeof item !== "object") return false;
  const notification = item as Partial<AppNotification>;
  return typeof notification.id === "string" &&
    (notification.type === "technical" ||
      notification.type === "payment" ||
      notification.type === "success" ||
      notification.type === "info") &&
    typeof notification.title === "string" &&
    typeof notification.message === "string" &&
    typeof notification.createdAt === "string" &&
    typeof notification.read === "boolean";
}

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/agent", label: "Playground", icon: Bot },
  { href: "/rules", label: "Rules & Settings", icon: BookOpenCheck },
  { href: "/approvals", label: "Approval Queue", icon: ShieldCheck, count: "2" },
  { href: "/audit", label: "Audit Ledger", icon: Activity },
];

function NavigationLink({
  href,
  label,
  icon: Icon,
  count,
  active,
  dataTour,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  count?: string;
  active: boolean;
  dataTour: string;
}) {
  return (
    <Link className={`nav-link${active ? " active" : ""}`} href={href} data-tour={dataTour}>
      <span className="nav-icon">
        <Icon size={17} strokeWidth={1.8} />
      </span>
      <span>{label}</span>
      {count && count !== "0" && <span className="nav-count">{count}</span>}
    </Link>
  );
}

const pageNames: Record<string, string> = {
  "/": "Overview",
  "/agent": "Agent Playground",
  "/rules": "Rules & Settings",
  "/approvals": "Approval Queue",
  "/audit": "Audit Ledger",
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [approvalCount, setApprovalCount] = useState(0);
  const [backendError, setBackendError] = useState<ApiErrorNotification | null>(null);
  const [technicalSecondsLeft, setTechnicalSecondsLeft] = useState(0);
  const [technicalDialogOpen, setTechnicalDialogOpen] = useState(false);
  const notifications = useSyncExternalStore(
    subscribeToAppNotificationStore,
    getAppNotificationsSnapshot,
    getServerAppNotificationsSnapshot,
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [statusToast, setStatusToast] = useState<AppNotification | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const activeHref = pathname === "/" ? "/" : `/${pathname.split("/")[1]}`;
  const title = pageNames[activeHref] ?? "Overview";

  useEffect(() => {
    function updateApprovalCount(event: Event) {
      const count = (event as CustomEvent<number>).detail;
      if (Number.isInteger(count) && count >= 0) setApprovalCount(count);
    }

    window.addEventListener("agentguard:approval-count", updateApprovalCount);
    return () => window.removeEventListener("agentguard:approval-count", updateApprovalCount);
  }, []);

  useEffect(() => {
    hydrateAppNotifications(loadNotifications());

    const unsubscribe = subscribeToAppNotifications((notification) => {
      if (notification.type !== "technical") {
        setStatusToast(notification);
        window.setTimeout(() => {
          setStatusToast((current) => current?.id === notification.id ? null : current);
        }, 5000);
      }
    });

    let welcomeTimer = 0;
    try {
      if (!window.localStorage.getItem(WELCOME_STORAGE_KEY)) {
        welcomeTimer = window.setTimeout(() => setManualOpen(true), 0);
      }
    } catch {
      welcomeTimer = window.setTimeout(() => setManualOpen(true), 0);
    }

    return () => {
      window.clearTimeout(welcomeTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    return subscribeToApiErrors((notification) => {
      if (notification.kind === "transaction") {
        setBackendError(notification);
        return;
      }

      const now = Date.now();
      const snoozedUntil = getTechnicalSnoozeUntil();
      if (snoozedUntil > now) return;

      const nextSnoozedUntil = now + TECHNICAL_ERROR_SNOOZE_MS;
      setTechnicalSnoozeUntil(nextSnoozedUntil);
      setTechnicalSecondsLeft(Math.ceil(TECHNICAL_ERROR_SNOOZE_MS / 1000));
      setTechnicalDialogOpen(true);
      setBackendError((current) =>
        current?.kind === "transaction"
          ? current
          : { ...notification, snoozedUntil: nextSnoozedUntil },
      );
    });
  }, []);

  useEffect(() => {
    if (backendError?.kind !== "technical" || !technicalDialogOpen) return;
    const timer = window.setTimeout(() => setTechnicalDialogOpen(false), 3000);
    return () => window.clearTimeout(timer);
  }, [backendError, technicalDialogOpen]);

  useEffect(() => {
    if (backendError?.kind !== "technical") return;
    const snoozedUntil = Number(backendError.snoozedUntil);
    if (!snoozedUntil) return;

    function updateCountdown() {
      const secondsLeft = Math.max(
        0,
        Math.ceil((snoozedUntil - Date.now()) / 1000),
      );
      setTechnicalSecondsLeft(secondsLeft);
      if (secondsLeft === 0) {
        clearTechnicalSnooze();
        clearApiError();
        setBackendError((current) =>
          current?.kind === "technical" ? null : current,
        );
      }
    }

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [backendError]);

  async function retryBackendRequest() {
    if (!backendError) return;
    try {
      await backendError.retry();
      clearApiError();
      clearTechnicalSnooze();
      setBackendError(null);
      window.location.reload();
    } catch (error) {
      setBackendError({
        ...backendError,
        message: error instanceof ApiError && backendError.kind === "transaction"
          ? error.message
          : "A temporary technical issue occurred. Our development team has been notified and is inspecting the system.",
      });
    }
  }

  function closeManual() {
    setManualOpen(false);
    try {
      window.localStorage.setItem(WELCOME_STORAGE_KEY, "true");
    } catch {
      // The guide can still be dismissed for the current app session.
    }
  }

  function startTour() {
    closeManual();
    setTourStep(0);
  }

  function markNotificationRead(id: string) {
    markAppNotificationRead(id);
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const navItems = navigation.map((item) =>
    item.href === "/approvals"
      ? { ...item, count: approvalCount > 0 ? String(approvalCount) : undefined }
      : item,
  );

  return (
    <div className="app-shell" data-theme={theme}>
      <div className="layout">
        <aside className="sidebar">
          <Link className="brand" href="/" aria-label="AgentGuard overview">
            <span className="brand-mark">
              <Shield size={20} fill="currentColor" strokeWidth={2} />
            </span>
            <span>
              <span className="brand-name">AgentGuard</span>
              <span className="brand-subtitle">by PayPal</span>
            </span>
          </Link>
          <div className="nav-label">Workspace</div>
          <nav className="nav-list" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavigationLink
                key={item.href}
                {...item}
                active={activeHref === item.href}
                dataTour={item.href === "/agent" ? "agent" : item.href.slice(1) || "overview"}
              />
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="security-card">
              <div className="security-card-title">
                <ShieldCheck size={15} color="#72d5a7" />
                Protection is on
              </div>
              <p>Every agent purchase is checked against your rules in real time.</p>
            </div>
            <div className="side-profile">
              <div className="profile-avatar">MC</div>
              <div>
                <div className="profile-name">Morgan Chen</div>
                <div className="profile-role">Personal account</div>
              </div>
            </div>
          </div>
        </aside>

        <div className="main-column">
          <header className="topbar">
            <div className="mobile-brand">
              <span className="mobile-brand-mark">
                <Shield size={16} fill="currentColor" />
              </span>
              AgentGuard
            </div>
            <div className="topbar-kicker">
              Workspace <span aria-hidden="true">/</span>{" "}
              <strong style={{ color: "var(--ink)", fontWeight: 650 }}>{title}</strong>
            </div>
            <div className="topbar-right">
              <button
                className="icon-button"
                type="button"
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              </button>
              <div className="notification-menu" data-tour="notifications">
              <button
                className="icon-button"
                type="button"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={16} />
                {unreadCount > 0 && <span className="notification-dot" />}
              </button>
              {notificationsOpen && (
                <NotificationsPanel
                  notifications={notifications}
                  onRead={markNotificationRead}
                  onClose={() => setNotificationsOpen(false)}
                />
              )}
              </div>
              <button
                className="icon-button"
                type="button"
              data-tour="help"
              aria-label="Open help and user guide"
                onClick={() => setManualOpen(true)}
              >
                <CircleHelp size={16} />
              </button>
              <span className="topbar-divider" />
              <div className="profile-menu" data-tour="profile">
                <button
                  className="topbar-user"
                  type="button"
                  aria-label="Open Morgan Chen profile"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((open) => !open)}
                >
                  <div className="profile-avatar">MC</div>
                  <div className="topbar-user-copy">
                    <div className="topbar-user-name">Morgan Chen</div>
                    <div className="topbar-user-role">Personal account</div>
                  </div>
                </button>
                {profileOpen && <ProfileFlyout onClose={() => setProfileOpen(false)} />}
              </div>
            </div>
          </header>
          <nav className="mobile-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavigationLink
                key={item.href}
                {...item}
                active={activeHref === item.href}
                dataTour={item.href === "/agent" ? "agent" : item.href.slice(1) || "overview"}
              />
            ))}
          </nav>
          <main className="page-content">{children}</main>
        </div>
      </div>
      <BackendErrorDialog
        error={backendError}
        remainingSeconds={technicalSecondsLeft}
        technicalExpanded={technicalDialogOpen}
        onMinimize={() => setTechnicalDialogOpen(false)}
        onClose={() => {
          clearApiError();
          setBackendError(null);
          setTechnicalDialogOpen(false);
        }}
        onRetry={retryBackendRequest}
      />
      {manualOpen && <WelcomeManualDialog onClose={closeManual} onStartTour={startTour} />}
      {tourStep !== null && (
        <TourSpotlight
          step={tourStep}
          onNext={() => setTourStep((current) => current === null || current >= 3 ? null : current + 1)}
          onClose={() => setTourStep(null)}
        />
      )}
      {statusToast && (
        <Toast
          message={`${statusToast.title}: ${statusToast.message}`}
          type={statusToast.type}
        />
      )}
    </div>
  );
}
