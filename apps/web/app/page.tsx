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
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { api } from "@/lib/api";
import { decisionTone, usd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { ApiNotice, LoadingState, MetricCard, PageHeading, SectionHeader, StatusPill } from "@/components/ui";

async function loadOverview() {
  const [stats, recent, approvals, rules, health] = await Promise.all([
    api.stats(),
    api.transactions({ limit: 5 }),
    api.approvals(),
    api.rules(),
    api.health(),
  ]);
  return { stats, recent, approvals, rules, health };
}

export default function OverviewPage() {
  const { data, error, loading, reload } = useApi(loadOverview);

  const heading = (
    <PageHeading
      eyebrow="AgentGuard · Protection active"
      title="Welcome back, Morgan"
      description="Here’s how AgentGuard is keeping your autonomous purchases safe."
      actions={
        <Link className="button button-primary" href="/agent">
          <Sparkles size={14} />
          Open playground
        </Link>
      }
    />
  );

  if (!data) {
    return (
      <>
        {heading}
        {error && <ApiNotice message={error} onRetry={reload} />}
        {loading && <LoadingState />}
      </>
    );
  }

  const { stats, recent, approvals, rules, health } = data;
  const total = stats.counts.approved + stats.counts.held + stats.counts.blocked;
  const passRate = total ? `${((100 * stats.counts.approved) / total).toFixed(1)}% pass rate` : "No requests yet";
  const week = stats.spending_by_day;
  const weekTotal = week.reduce((sum, day) => sum + day.amount, 0);
  const maxDay = Math.max(...week.map((day) => day.amount), 1);
  const budgetUsed = Math.min(100, (100 * stats.spent_so_far) / stats.total_budget);
  const llmReady = health.llm === "ready";
  const paypal = health.paypal_mode === "sandbox" ? "PayPal Sandbox" : "Mock PayPal (no money moves)";

  return (
    <>
      {heading}
      {error && <ApiNotice message={error} onRetry={reload} />}

      <section className="dashboard-hero">
        <div>
          <div className="dashboard-hero-label">Total agent spending</div>
          <div className="dashboard-hero-value">{usd(stats.spent_so_far)} <span style={{ fontSize: 13, letterSpacing: 0 }}>USD</span></div>
          <div className="dashboard-hero-meta">
            <span>Remaining budget: <strong>{usd(stats.remaining_budget)}</strong> of {usd(stats.total_budget)}</span>
            <span>Blocked before payment: {usd(stats.blocked_amount)}</span>
          </div>
        </div>
        <div className="dashboard-hero-side">
          <div className="detail-row"><span>AI safety check</span><strong>{llmReady ? "Online" : health.llm}</strong></div>
          <div className="detail-row"><span>Payments</span><strong>{paypal}</strong></div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Account metrics">
        <MetricCard label="Transactions" value={String(total)} foot="All agent requests" icon={CircleDollarSign} />
        <MetricCard label="Allowed" value={String(stats.counts.approved)} foot={passRate} icon={CreditCard} positive />
        <MetricCard label="Blocked" value={String(stats.counts.blocked)} foot="Stopped before payment" icon={ShieldAlert} positive />
        <MetricCard label="Pending" value={String(stats.pending_approvals)} foot="Human-in-the-loop" icon={Clock3} />
      </section>

      <div className="content-grid">
        <div className="stack">
          <section className="card card-pad">
            <SectionHeader
              title="Agent activity"
              subtitle="Live status of the AgentGuard decision engine"
              action={
                <StatusPill tone={llmReady ? "success" : "warning"} icon={llmReady ? BadgeCheck : ShieldAlert}>
                  {llmReady ? "All systems protected" : "Degraded"}
                </StatusPill>
              }
            />
            <div className="agent-health" style={llmReady ? undefined : { background: "var(--amber-soft)" }}>
              <span className="health-icon">
                {llmReady ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
              </span>
              <div>
                <div className="health-title">{llmReady ? "AgentGuard is active" : "AI safety check unavailable"}</div>
                <div className="health-subtitle">
                  {llmReady
                    ? "The AI safety scan and policy rules run before every payment."
                    : health.llm.startsWith("offline")
                      ? "Offline mode: heuristics and policy rules still run before every payment."
                      : "AgentGuard fails closed, so every purchase is blocked until the AI check is restored."}
                </div>
              </div>
            </div>
            <div className="divider" />
            <div className="section-header" style={{ marginBottom: 10 }}>
              <div>
                <h3 className="section-title" style={{ fontSize: 12 }}>Spending & velocity</h3>
                <p className="section-subtitle">Seven-day agent spending</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 750 }}>{usd(weekTotal)}</div>
                <div className="metric-foot positive" style={{ justifyContent: "flex-end", marginTop: 4 }}>
                  Last 7 days
                </div>
              </div>
            </div>
            <div className="chart-area" aria-label="Spending by day">
              {week.map(({ day, date, amount }, index) => (
                <div className="chart-column" key={date}>
                  <span className="chart-value">${Math.round(amount)}</span>
                  <div
                    className={`chart-bar${index === week.length - 1 ? " highlight" : ""}`}
                    style={{ height: `${Math.max(9, (amount / maxDay) * 90)}%` }}
                    title={`${day} ${date}: ${usd(amount)}`}
                  />
                  <span className="chart-label">{day}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card card-pad">
            <SectionHeader
              title="Recent agent activity"
              subtitle="Latest decisions made by AgentGuard"
              action={
                <Link className="button button-quiet" href="/audit">
                  View all <ArrowRight size={13} />
                </Link>
              }
            />
            {recent.length === 0 ? (
              <div className="empty-state" style={{ padding: "18px 10px" }}>
                <h3>No agent purchases yet</h3>
                <p>Run a task in the playground to see AgentGuard decide.</p>
              </div>
            ) : (
              <div className="activity-list">
                {recent.map((transaction) => (
                  <div className="activity-item" key={transaction.id}>
                    <span className="merchant-logo">{transaction.merchantInitials}</span>
                    <div className="activity-item-main">
                      <div className="activity-item-top">
                        <span className="merchant-name">{transaction.merchant}</span>
                        <span className="activity-item-amount">{usd(transaction.amount)}</span>
                      </div>
                      <div className="merchant-meta">{transaction.product}</div>
                      <div className="activity-item-foot">
                        <span className="merchant-meta">Agent: {transaction.agent}</span>
                        <StatusPill tone={decisionTone[transaction.status]}>{transaction.status}</StatusPill>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                <div className="bar-row-top"><span>Total budget</span><strong>{usd(stats.spent_so_far)} / {usd(stats.total_budget)}</strong></div>
                <div className="bar-track"><div className="bar-fill green" style={{ width: `${budgetUsed}%` }} /></div>
              </div>
            </div>
            <div className="divider" />
            <div className="detail-row"><span>Per-transaction cap</span><strong>{usd(rules.max_per_order)}</strong></div>
            <div className="detail-row"><span>Approval required above</span><strong>{usd(rules.approval_limit)}</strong></div>
            <div className="detail-row"><span>Merchant minimum rating</span><strong>{rules.min_merchant_rating.toFixed(1)} / 5.0</strong></div>
            <div className="detail-row"><span>Allowed categories</span><strong>{rules.allowed_categories.length}</strong></div>
            <div className="detail-row">
              <span>Return policy</span>
              <StatusPill tone={rules.require_return_policy ? "info" : "neutral"}>{rules.require_return_policy ? "Required" : "Not required"}</StatusPill>
            </div>
          </section>

          <section className="card card-pad">
            <SectionHeader
              title="Approval queue"
              subtitle="Purchases that need your decision"
              action={<StatusPill tone={approvals.length ? "warning" : "success"}>{approvals.length} waiting</StatusPill>}
            />
            <div className="decision-list">
              {approvals.length === 0 && <p className="section-subtitle">Nothing is waiting for you.</p>}
              {approvals.slice(0, 4).map((transaction) => (
                <Link className="decision-row" key={transaction.id} href="/approvals">
                  <span className="merchant-logo">{transaction.merchantInitials}</span>
                  <div className="decision-main">
                    <div className="decision-name">{transaction.product}</div>
                    <div className="decision-meta">{transaction.merchant} · {usd(transaction.amount)}</div>
                  </div>
                  <ArrowUpRight size={14} className="muted" />
                </Link>
              ))}
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
                <p className="section-subtitle">
                  Payments run through {paypal}. Held purchases are only reserved until you approve them.
                </p>
              </div>
            </div>
            <Link href="/audit" className="button button-quiet" style={{ marginTop: 9, paddingLeft: 0 }}>
              Browse decision receipts <ExternalLink size={12} />
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
