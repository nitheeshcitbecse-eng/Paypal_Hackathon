"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ExternalLink,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MetricCard, PageHeading, SectionHeader, StatusPill, Toast, Toggle } from "@/components/ui";
import { getApprovals, getOrders, getRules, type Approval, type RuleSet, type Transaction } from "@/lib/api";

export default function OverviewPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [toast, setToast] = useState("");
  const [orders, setOrders] = useState<Transaction[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [rules, setRules] = useState<RuleSet | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getOrders().catch(() => []),
      getApprovals().catch(() => []),
      getRules().catch(() => null),
    ]).then(([loadedOrders, loadedApprovals, loadedRules]) => {
      if (!active) return;
      setOrders(loadedOrders);
      setApprovals(loadedApprovals);
      setRules(loadedRules);
      window.dispatchEvent(
        new CustomEvent<number>("agentguard:approval-count", { detail: loadedApprovals.length }),
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const totalSpent = orders.reduce(
    (sum, order) => sum + (order.status === "Approved" ? Number(order.amount) || 0 : 0),
    0,
  );
  const approvedCount = orders.filter((order) => order.status === "Approved").length;
  const blockedCount = orders.filter((order) => order.status === "Blocked").length;

  function toggleAgent() {
    setIsRunning((running) => !running);
    setToast(isRunning ? "Agent automation paused." : "Agent automation resumed.");
    window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <>
      <PageHeading
        eyebrow="Autonomous engine V2.4 · Protection active"
        title="Good morning, Morgan"
        description="Here’s how AgentGuard is keeping your autonomous purchases safe."
        actions={
          <Link className="button button-primary" href="/agent">
            <Sparkles size={14} />
            Open playground
          </Link>
        }
      />

      <section className="dashboard-hero">
        <div>
          <div className="dashboard-hero-label">Total agent spending</div>
          <div className="dashboard-hero-value">${totalSpent.toFixed(2)} <span style={{ fontSize: 13, letterSpacing: 0 }}>USD</span></div>
          <div className="dashboard-hero-meta">
            <span>Total recorded volume: <strong>${totalSpent.toFixed(2)}</strong></span>
            <span>{orders.length === 0 ? "No transactions recorded yet." : `${orders.length} recorded transactions`}</span>
          </div>
        </div>
        <div className="dashboard-hero-side">
          <div className="detail-row"><span>Policy integrity</span><strong>{rules ? "Rules loaded" : "No rules configured"}</strong></div>
          <div className="detail-row"><span>Autonomous agents</span><strong>{isRunning ? "Protection active" : "No active agents"}</strong></div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Account metrics">
        <MetricCard
          label="Transactions"
          value={String(orders.length)}
          foot="Recorded orders"
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Allowed"
          value={String(approvedCount)}
          foot="Approved orders"
          icon={CreditCard}
          positive
        />
        <MetricCard
          label="Blocked"
          value={String(blockedCount)}
          foot="Blocked orders"
          icon={ShieldAlert}
          positive
        />
        <MetricCard
          label="Pending"
          value={String(approvals.length)}
          foot="Human-in-the-loop"
          icon={Clock3}
        />
      </section>

      <div className="content-grid">
        <div className="stack">
          <section className="card card-pad">
            <SectionHeader
              title="Agent activity"
              subtitle="Live status across your connected shopping agents"
              action={
                <StatusPill tone={isRunning ? "success" : "neutral"} icon={isRunning ? BadgeCheck : LockKeyhole}>
                  {isRunning ? "All systems protected" : "Automation paused"}
                </StatusPill>
              }
            />
            <div className="agent-health">
              <span className="health-icon">
                <ShieldCheck size={18} />
              </span>
              <div>
                <div className="health-title">{isRunning ? "AgentGuard is active" : "No active agent sessions"}</div>
                <div className="health-subtitle">
                  {isRunning
                    ? "Policy checks are running before every payment."
                    : "Start a purchase request from the Agent tab to create live activity."}
                </div>
              </div>
              <div className="health-state">
                <Toggle checked={isRunning} onChange={toggleAgent} label="Toggle agent automation" />
              </div>
            </div>
            <div className="divider" />
            <div className="section-header" style={{ marginBottom: 10 }}>
              <div>
                <h3 className="section-title" style={{ fontSize: 12 }}>Spending & velocity</h3>
                <p className="section-subtitle">Seven-day agent transaction activity</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 750 }}>${totalSpent.toFixed(2)}</div>
                <div className="metric-foot" style={{ justifyContent: "flex-end", marginTop: 4 }}>
                  <CircleDollarSign size={12} /> Total volume
                </div>
              </div>
            </div>
            <div className="chart-area" aria-label="Spending by day">
              {orders.length > 0 ? orders.slice(-7).map((order, index, visibleOrders) => (
                <div className="chart-column" key={order.id}>
                  <span className="chart-value">${Number(order.amount || 0).toFixed(0)}</span>
                  <div
                    className={`chart-bar${index === visibleOrders.length - 1 ? " highlight" : ""}`}
                    style={{ height: `${Math.max(9, (Number(order.amount) || 0) / Math.max(totalSpent, 1) * 100)}%` }}
                    title={`${order.date}: $${Number(order.amount || 0).toFixed(2)}`}
                  />
                  <span className="chart-label">{order.date}</span>
                </div>
              )) : <p className="section-subtitle">No spending activity yet. Submit a purchase request to populate this chart.</p>}
            </div>
          </section>

          <section className="card card-pad">
            <SectionHeader
              title="Recent agent activity"
              subtitle="Latest decisions made by your agents"
              action={
                <Link className="button button-quiet" href="/audit">
                  View all <ArrowRight size={13} />
                </Link>
              }
            />
            <div className="activity-list">
              {orders.slice(-4).reverse().map((transaction) => (
                <div className="activity-item" key={transaction.id}>
                  <span className="merchant-logo">{transaction.merchantInitials}</span>
                  <div className="activity-item-main">
                    <div className="activity-item-top">
                      <span className="merchant-name">{transaction.merchant}</span>
                      <span className="activity-item-amount">${transaction.amount.toFixed(2)}</span>
                    </div>
                    <div className="merchant-meta">{transaction.product}</div>
                    <div className="activity-item-foot">
                      <span className="merchant-meta">Agent: {transaction.agent}</span>
                      <StatusPill tone={transaction.status === "Approved" ? "success" : transaction.status === "Held" ? "warning" : "danger"}>
                        {transaction.status}
                      </StatusPill>
                    </div>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="empty-state">
                  <h3>No recent agent activity</h3>
                  <p>No active transactions found. Use the Agent tab to initiate a purchase request and populate data in real time.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card card-pad">
            <SectionHeader
              title="Safety snapshot"
              subtitle="Your policy guardrails at a glance"
              action={<Link className="button button-quiet" href="/rules">Edit rules</Link>}
            />
            <div className="bar-list">
              <div>
                <div className="bar-row-top"><span>Recorded spend</span><strong>${totalSpent.toFixed(2)} / ${Number(rules?.dailyCap ?? 0).toFixed(2)}</strong></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${rules?.dailyCap ? Math.min(100, totalSpent / rules.dailyCap * 100) : 0}%` }} /></div>
              </div>
              <div>
                <div className="bar-row-top"><span>Transactions</span><strong>{orders.length}</strong></div>
                <div className="bar-track"><div className="bar-fill green" style={{ width: `${Math.min(100, orders.length)}%` }} /></div>
              </div>
            </div>
            <div className="divider" />
            <div className="detail-row"><span>Per-transaction cap</span><strong>${Number(rules?.transactionCap ?? 0).toFixed(2)}</strong></div>
            <div className="detail-row"><span>Allowed categories</span><strong>{rules?.allowedCategories?.length ?? 0}</strong></div>
            <div className="detail-row"><span>Policy mode</span><StatusPill tone="info">{rules?.strict ? "Strict" : "Not configured"}</StatusPill></div>
          </section>

          <section className="card card-pad">
            <SectionHeader
              title="Approval queue"
              subtitle="Purchases that need your decision"
              action={              <StatusPill tone={approvals.length ? "warning" : "neutral"}>{approvals.length} waiting</StatusPill>}
            />
            <div className="decision-list">
              {approvals.map((transaction) => (
                  <div className="decision-row" key={transaction.id}>
                    <span className="merchant-logo">{transaction.merchantInitials}</span>
                    <div className="decision-main">
                      <div className="decision-name">{transaction.product}</div>
                      <div className="decision-meta">{transaction.merchant} · ${transaction.amount.toFixed(2)}</div>
                    </div>
                    <ArrowUpRight size={14} className="muted" />
                  </div>
                ))}
              {approvals.length === 0 && <p className="section-subtitle">No purchases are waiting for approval.</p>}
            </div>
            <Link className="button button-secondary" href="/approvals" style={{ width: "100%", marginTop: 12 }}>
              Review approvals <ArrowRight size={13} />
            </Link>
          </section>

          <section className="card card-pad">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span className="rule-icon"><WalletCards size={17} /></span>
              <div>
                <h3 className="section-title" style={{ fontSize: 12 }}>PayPal protection</h3>
                <p className="section-subtitle">Zero-liability coverage is active for eligible purchases.</p>
              </div>
            </div>
            <Link href="/audit" className="button button-quiet" style={{ marginTop: 9, paddingLeft: 0 }}>
              Learn about decision receipts <ExternalLink size={12} />
            </Link>
          </section>
        </div>
      </div>
      {toast && <Toast message={toast} />}
    </>
  );
}
