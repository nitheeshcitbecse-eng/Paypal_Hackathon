"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Play,
  Star,
  X,
} from "lucide-react";
import { useState } from "react";
import { ApiNotice, LoadingState, PageHeading, SectionHeader, StatusPill, Toast } from "@/components/ui";
import { ReceiptChecks } from "@/components/receipt-checks";
import { api, refreshApprovalCount } from "@/lib/api";
import { decisionTone, formatDate, usd } from "@/lib/format";
import { messageOf, useApi, useToast } from "@/lib/hooks";
import type { Transaction } from "@/lib/types";

async function loadQueue() {
  const [queue, merchants, history] = await Promise.all([api.approvals(), api.merchants(), api.transactions({ limit: 200 })]);
  const recent = history
    .filter((item) => item.approvalStatus === "approved" || item.approvalStatus === "rejected")
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""))
    .slice(0, 4);
  return { queue, merchants, recent };
}

export default function ApprovalsPage() {
  const { data, error, loading, reload } = useApi(loadQueue);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const { toast, show } = useToast(3600);

  const queue = data?.queue ?? [];
  const selected: Transaction | undefined = queue.find((item) => item.id === selectedId) ?? queue[0];
  const merchant = selected
    ? data?.merchants.find((m) => m.name.toLowerCase() === selected.merchant.toLowerCase())
    : undefined;

  async function decide(approved: boolean) {
    if (!selected) return;
    setBusy(approved ? "approve" : "reject");
    try {
      const updated = approved ? await api.approve(selected.id, note) : await api.reject(selected.id, note);
      if (!approved) {
        show(`${updated.merchant} purchase declined. The reserved amount was released.`);
      } else if (updated.paymentStatus === "PAYER_ACTION_REQUIRED") {
        show(`${updated.merchant} purchase approved. Approve the order as the PayPal Sandbox buyer, then capture it from the Audit Ledger.`);
      } else {
        show(`${updated.merchant} purchase approved and paid through PayPal.`);
      }
      setNote("");
      setSelectedId(null);
      reload();
      void refreshApprovalCount();
    } catch (err) {
      show(messageOf(err), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Human approval queue"
        title="Review agent purchases"
        description="Review the reason for each hold before authorizing an agent to pay."
        actions={
          data ? (
            <StatusPill tone={queue.length > 0 ? "warning" : "success"} icon={queue.length > 0 ? Clock3 : CheckCircle2}>
              {queue.length} awaiting your decision
            </StatusPill>
          ) : undefined
        }
      />

      {error && <ApiNotice message={error} onRetry={reload} />}

      <div className="queue-card card">
        <div className="queue-card-top">
          <div>
            <div className="section-title">{data ? `${queue.length} transactions awaiting your decision` : "Approval queue"}</div>
            <div className="section-subtitle">A held purchase is reserved on PayPal and will not be charged unless you approve it.</div>
          </div>
          {selected && <span className="queue-priority"><AlertTriangle size={13} /> Priority review</span>}
        </div>

        {!data && loading ? (
          <LoadingState />
        ) : selected ? (
          <div className="queue-body">
            <div className="queue-main">
              <div className="queue-merchant">
                <span className="merchant-logo large">{selected.merchantInitials}</span>
                <div>
                  <div className="merchant-name" style={{ fontSize: 13 }}>{selected.merchant}</div>
                  <div className="merchant-meta" style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 5 }}>
                    <BadgeCheck size={12} color="var(--green)" /> Registered merchant · {selected.id}
                  </div>
                </div>
              </div>
              <div className="queue-product">{selected.product}</div>
              <div className="queue-amount">{usd(selected.amount)}<small>{selected.currency}</small></div>
              <div className="rule-copy" style={{ marginTop: 6 }}>
                {selected.category} · requested by {selected.agent} · {formatDate(selected.date)}
              </div>
              <div className="rule-copy" style={{ marginTop: 4 }}>Task: “{selected.task}”</div>

              <div className="reason-box">
                <div className="reason-label"><AlertTriangle size={13} /> Reason for hold</div>
                <p className="reason-copy">{selected.reason}</p>
              </div>

              <label style={{ display: "block", marginTop: 12 }}>
                <span className="form-label">Note (optional)</span>
                <input
                  className="input"
                  value={note}
                  maxLength={500}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Why you approved or declined"
                  aria-label="Decision note"
                />
              </label>

              <div className="queue-actions">
                <button className="button button-danger" type="button" onClick={() => decide(false)} disabled={busy !== null}>
                  {busy === "reject" ? <LoaderCircle size={14} className="spin" /> : <X size={14} />} Decline purchase
                </button>
                <button className="button button-success" type="button" onClick={() => decide(true)} disabled={busy !== null}>
                  {busy === "approve" ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Approve & pay <ArrowRight size={13} />
                </button>
              </div>
              <div className="section-subtitle" style={{ marginTop: 10 }}>
                By approving, you authorize this payment through PayPal. Your remaining budget is checked again first.
              </div>
              {selected.approveUrl && (
                <a className="button button-quiet" href={selected.approveUrl} target="_blank" rel="noreferrer" style={{ paddingLeft: 0, marginTop: 6 }}>
                  Open PayPal Sandbox order <ExternalLink size={12} />
                </a>
              )}
            </div>

            <aside className="queue-side">
              <SectionHeader title="Merchant trust" subtitle="From the merchant registry" />
              <div className="detail-row">
                <span>Merchant rating</span>
                <strong style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Star size={12} fill="#e5a545" color="#e5a545" /> {merchant ? `${merchant.rating.toFixed(1)} / 5.0` : "Unknown"}
                </strong>
              </div>
              <div className="detail-row">
                <span>Return policy</span>
                <strong style={{ color: merchant?.has_return_policy ? "var(--green)" : "var(--red)" }}>
                  {merchant ? (merchant.has_return_policy ? "Offered" : "None") : "Unknown"}
                </strong>
              </div>
              <div className="detail-row"><span>Agent</span><strong>{selected.agent}</strong></div>
              <div className="detail-row"><span>Receipt</span><strong>{selected.receiptId}</strong></div>

              <div className="divider" />
              <SectionHeader title="Policy checks" subtitle="What AgentGuard verified" />
              <ReceiptChecks checks={selected.receipt.checks} />
              <div className="divider" />
              <Link className="button button-quiet" href="/audit">
                See all decision receipts <ArrowRight size={12} />
              </Link>
            </aside>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon"><CheckCircle2 size={22} /></span>
            <h3>All caught up</h3>
            <p>Your agents are operating within the configured safety ceilings.</p>
            <Link className="button button-secondary" href="/agent" style={{ marginTop: 14 }}>
              <Play size={13} /> Run a task in the playground
            </Link>
          </div>
        )}
      </div>

      {data && (queue.length > 0 || data.recent.length > 0) && (
        <div className="content-grid">
          <section className="card card-pad">
            <SectionHeader title="Waiting for your review" subtitle="Select an item to inspect its details." />
            {queue.length === 0 ? (
              <p className="section-subtitle">Nothing is waiting right now.</p>
            ) : (
              <div className="decision-list">
                {queue.map((item) => (
                  <button
                    type="button"
                    className="decision-row"
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      borderColor: item.id === selected?.id ? "var(--blue)" : "var(--line)",
                    }}
                  >
                    <span className="merchant-logo">{item.merchantInitials}</span>
                    <span className="decision-main">
                      <span className="decision-name" style={{ display: "block" }}>{item.merchant}</span>
                      <span className="decision-meta" style={{ display: "block" }}>{item.product} · {usd(item.amount)}</span>
                    </span>
                    <ArrowRight size={13} className="muted" />
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="card card-pad">
            <SectionHeader title="Recent decision actions" subtitle="Your latest approvals and declines" />
            {data.recent.length === 0 ? (
              <p className="section-subtitle">You haven&apos;t decided on any held purchases yet.</p>
            ) : (
              <div className="decision-list">
                {data.recent.map((item) => (
                  <div className="decision-row" key={item.id}>
                    <span
                      className="health-icon"
                      style={item.status === "Approved" ? undefined : { background: "var(--red-soft)", color: "var(--red)" }}
                    >
                      {item.status === "Approved" ? <CheckCircle2 size={15} /> : <X size={14} />}
                    </span>
                    <div className="decision-main">
                      <div className="decision-name">{item.product}</div>
                      <div className="decision-meta">
                        {item.approvalStatus === "approved" ? "Approved" : "Declined"} {formatDate(item.decidedAt)} · {item.agent}
                      </div>
                    </div>
                    <StatusPill tone={decisionTone[item.status]}>{item.approvalStatus === "approved" ? "Approved" : "Declined"}</StatusPill>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </>
  );
}
