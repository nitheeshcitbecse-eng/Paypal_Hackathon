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
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/agent", label: "Playground", icon: Bot },
  { href: "/rules", label: "Rules & Settings", icon: BookOpenCheck },
  { href: "/approvals", label: "Approval Queue", icon: ShieldCheck },
  { href: "/audit", label: "Audit Ledger", icon: Activity },
];

function NavigationLink({
  href,
  label,
  icon: Icon,
  count,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  count?: string;
  active: boolean;
}) {
  return (
    <Link className={`nav-link${active ? " active" : ""}`} href={href}>
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

  // Refresh the approval badge from the API whenever the page changes.
  useEffect(() => {
    let cancelled = false;
    api.approvals().then(
      (queue) => {
        if (!cancelled) setApprovalCount(queue.length);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [pathname]);

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
              <button className="icon-button" type="button" aria-label="Notifications">
                <Bell size={16} />
                <span className="notification-dot" />
              </button>
              <button className="icon-button" type="button" aria-label="Help">
                <CircleHelp size={16} />
              </button>
              <span className="topbar-divider" />
              <div className="topbar-user">
                <div className="profile-avatar">MC</div>
                <div className="topbar-user-copy">
                  <div className="topbar-user-name">Morgan Chen</div>
                  <div className="topbar-user-role">Personal account</div>
                </div>
              </div>
            </div>
          </header>
          <nav className="mobile-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavigationLink
                key={item.href}
                {...item}
                active={activeHref === item.href}
              />
            ))}
          </nav>
          <main className="page-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
