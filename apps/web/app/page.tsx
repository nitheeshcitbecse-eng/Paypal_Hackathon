"use client";

import Link from "next/link";
import {
  ArrowDownRight,
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
import { useState } from "react";
import { activity, spendingByDay, transactions } from "@/mocks/data";
import { MetricCard, PageHeading, SectionHeader, StatusPill, Toast, Toggle } from "@/components/ui";

export default function OverviewPage() {
  const [isRunning, setIsRunning] = useState(true);
  const [toast, setToast] = useState("");

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
          <div className="dashboard-hero-value">$18,450.20 <span style={{ fontSize: 13, letterSpacing: 0 }}>USD</span></div>
          <div className="dashboard-hero-meta">
            <span>Today&apos;s volume: <strong>$4,200.00</strong></span>
            <span>Budget cycle resets in 8 days</span>
          </div>
        </div>
        <div className="dashboard-hero-side">
          <div className="detail-row"><span>Policy integrity</span><strong>All 5 safeguards enforced</strong></div>
          <div className="detail-row"><span>Autonomous agents</span><strong>{isRunning ? "Protection active" : "Paused"}</strong></div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Account metrics">
        <MetricCard
          label="Transactions"
          value="1,428"
          foot="+12% vs last week"
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Allowed"
          value="1,290"
          foot="90.3% pass rate"
          icon={CreditCard}
          positive
        />
        <MetricCard
          label="Blocked"
          value="94"
          foot="Critical mitigations"
          icon={ShieldAlert}
          positive
        />
        <MetricCard
          label="Pending"
          value="44"
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
                <div className="health-title">{isRunning ? "AgentGuard is active" : "AgentGuard is paused"}</div>
                <div className="health-subtitle">
                  {isRunning
                    ? "Policy checks are running before every payment."
                    : "No new autonomous payments will be authorized."}
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
                <div style={{ fontSize: 18, fontWeight: 750 }}>$4,200</div>
                <div className="metric-foot positive" style={{ justifyContent: "flex-end", marginTop: 4 }}>
                  <ArrowDownRight size={12} /> Sunday volume
                </div>
              </div>
            </div>
            <div className="chart-area" aria-label="Spending by day">
              {spendingByDay.map(({ day, amount }, index) => (
                <div className="chart-column" key={day}>
                  <span className="chart-value">${amount}</span>
                  <div
                    className={`chart-bar${index === spendingByDay.length - 1 ? " highlight" : ""}`}
                    style={{ height: `${Math.max(9, amount / 2.4)}%` }}
                    title={`${day}: $${amount}`}
                  />
                  <span className="chart-label">{day}</span>
                </div>
              ))}
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
              {activity.map((transaction) => (
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
                <div className="bar-row-top"><span>Daily spend</span><strong>$420 / $1,000</strong></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: "42%" }} /></div>
              </div>
              <div>
                <div className="bar-row-top"><span>Monthly budget</span><strong>$2,840 / $5,000</strong></div>
                <div className="bar-track"><div className="bar-fill green" style={{ width: "57%" }} /></div>
              </div>
            </div>
            <div className="divider" />
            <div className="detail-row"><span>Per-transaction cap</span><strong>$250.00</strong></div>
            <div className="detail-row"><span>Merchant minimum rating</span><strong>4.2 / 5.0</strong></div>
            <div className="detail-row"><span>Restricted categories</span><strong>4 hard blocks</strong></div>
            <div className="detail-row"><span>Policy mode</span><StatusPill tone="info">Strict</StatusPill></div>
          </section>

          <section className="card card-pad">
            <SectionHeader
              title="Approval queue"
              subtitle="Purchases that need your decision"
              action={<StatusPill tone="warning">2 waiting</StatusPill>}
            />
            <div className="decision-list">
              {transactions
                .filter((transaction) => transaction.status === "Held")
                .map((transaction) => (
                  <div className="decision-row" key={transaction.id}>
                    <span className="merchant-logo">{transaction.merchantInitials}</span>
                    <div className="decision-main">
                      <div className="decision-name">{transaction.product}</div>
                      <div className="decision-meta">{transaction.merchant} · ${transaction.amount.toFixed(2)}</div>
                    </div>
                    <ArrowUpRight size={14} className="muted" />
                  </div>
                ))}
              <div className="decision-row">
                <span className="merchant-logo">SM</span>
                <div className="decision-main">
                  <div className="decision-name">Wireless studio microphone</div>
                  <div className="decision-meta">Sound Market · $189.00</div>
                </div>
                <Clock3 size={14} className="muted" />
              </div>
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
