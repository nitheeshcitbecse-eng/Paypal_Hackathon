"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileSearch,
  ShieldCheck,
  Star,
  Undo2,
  X,
} from "lucide-react";
import { useState } from "react";
import { PageHeading, SectionHeader, StatusPill, Toast } from "@/components/ui";
import { transactions, type Transaction } from "@/mocks/data";

type PendingPurchase = Transaction & {
  merchantRating: string;
  reviews: string;
  holdReason: string;
};

const initialQueue: PendingPurchase[] = [
  {
    ...transactions[0],
    merchantRating: "4.8 / 5.0",
    reviews: "850 reviews",
    holdReason: "Exceeds standard agent autonomy cap ($250.00) by $99.00. This is the first purchase recorded with this agent vendor.",
  },
  {
    id: "PP-AG-99221-Q",
    merchant: "Sound Market",
    merchantInitials: "SM",
    product: "Wireless studio microphone",
    agent: "CreatorAssist",
    amount: 189,
    currency: "USD",
    date: "Today, 10:28 AM",
    status: "Held",
    category: "Electronics",
    reason: "New vendor · merchant has not been used by this agent before.",
    receiptId: "rcpt_29DD0816A1",
    merchantRating: "4.6 / 5.0",
    reviews: "2,140 reviews",
    holdReason: "First purchase with this vendor. Confirm that this merchant and product are expected.",
  },
];

export default function ApprovalsPage() {
  const [queue, setQueue] = useState(initialQueue);
  const [selectedId, setSelectedId] = useState(initialQueue[0].id);
  const [toast, setToast] = useState("");
  const selected: PendingPurchase | undefined = queue.find((item) => item.id === selectedId);

  function decide(approved: boolean) {
    if (!selected) return;
    const merchant = selected.merchant;
    setQueue((current) => current.filter((item) => item.id !== selected.id));
    window.dispatchEvent(
      new CustomEvent<number>("agentguard:approval-count", { detail: queue.length - 1 }),
    );
    setSelectedId((current) => {
      const next = queue.find((item) => item.id !== current);
      return next?.id ?? "";
    });
    setToast(`${merchant} purchase ${approved ? "approved and authorized" : "declined"}.`);
    window.setTimeout(() => setToast(""), 2800);
  }

  function resetQueue() {
    setQueue(initialQueue);
    setSelectedId(initialQueue[0].id);
    window.dispatchEvent(
      new CustomEvent<number>("agentguard:approval-count", { detail: initialQueue.length }),
    );
    setToast("Demo approval queue restored.");
    window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <>
      <PageHeading
        eyebrow="Human approval queue"
        title="Review agent purchases"
        description="Review the reason for each hold before authorizing an agent to pay."
        actions={<StatusPill tone={queue.length > 0 ? "warning" : "success"} icon={queue.length > 0 ? Clock3 : CheckCircle2}>{queue.length} awaiting your decision</StatusPill>}
      />

      <div className="queue-card card">
        <div className="queue-card-top">
          <div>
            <div className="section-title">{queue.length} transactions awaiting your decision</div>
            <div className="section-subtitle">A held purchase will not be charged unless you approve it.</div>
          </div>
          {selected && <span className="queue-priority"><AlertTriangle size={13} /> Priority review</span>}
        </div>

        {selected ? (
          <div className="queue-body">
            <div className="queue-main">
              <div className="queue-merchant">
                <span className="merchant-logo large">{selected.merchantInitials}</span>
                <div>
                  <div className="merchant-name" style={{ fontSize: 13 }}>{selected.merchant}</div>
                  <div className="merchant-meta" style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 5 }}>
                    <BadgeCheck size={12} color="var(--green)" /> Verified PayPal merchant · {selected.id}
                  </div>
                </div>
              </div>
              <div className="queue-product">{selected.product}</div>
              <div className="queue-amount">${selected.amount.toFixed(2)}<small>{selected.currency}</small></div>
              <div className="rule-copy" style={{ marginTop: 6 }}>{selected.category} · requested by {selected.agent}</div>

              <div className="reason-box">
                <div className="reason-label"><AlertTriangle size={13} /> Reason for hold</div>
                <p className="reason-copy">{selected.holdReason}</p>
              </div>

              <div className="queue-actions">
                <button className="button button-danger" type="button" onClick={() => decide(false)}>
                  <X size={14} /> Decline purchase
                </button>
                <button className="button button-success" type="button" onClick={() => decide(true)}>
                  <Check size={14} /> Approve & pay <ArrowRight size={13} />
                </button>
              </div>
              <div className="section-subtitle" style={{ marginTop: 10 }}>
                By approving, you authorize this payment through PayPal.
              </div>
            </div>

            <aside className="queue-side">
              <SectionHeader title="Merchant trust" subtitle="Verified seller details" />
              <div className="detail-row">
                <span>Merchant rating</span>
                <strong style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Star size={12} fill="#e5a545" color="#e5a545" /> {selected.merchantRating}
                </strong>
              </div>
              <div className="detail-row"><span>Customer reviews</span><strong>{selected.reviews}</strong></div>
              <div className="detail-row"><span>Return policy</span><strong style={{ color: "var(--green)" }}>7-day guarantee</strong></div>
              <div className="detail-row"><span>Agent</span><strong>{selected.agent}</strong></div>

              <div className="divider" />
              <SectionHeader title="Policy checks" subtitle="What AgentGuard verified" />
              <div className="decision-list">
                <div className="decision-row">
                  <span className="health-icon"><FileSearch size={14} /></span>
                  <div className="decision-main">
                    <div className="decision-name">Request integrity</div>
                    <div className="decision-meta">No prompt injection detected</div>
                  </div>
                  <CheckCircle2 size={14} color="var(--green)" />
                </div>
                <div className="decision-row">
                  <span className="health-icon"><CircleDollarSign size={14} /></span>
                  <div className="decision-main">
                    <div className="decision-name">Purchase limit</div>
                    <div className="decision-meta">Exceeds autonomy cap</div>
                  </div>
                  <AlertTriangle size={14} color="var(--amber)" />
                </div>
                <div className="decision-row">
                  <span className="health-icon"><ShieldCheck size={14} /></span>
                  <div className="decision-main">
                    <div className="decision-name">Merchant status</div>
                    <div className="decision-meta">Verified PayPal seller</div>
                  </div>
                  <CheckCircle2 size={14} color="var(--green)" />
                </div>
              </div>
              <div className="divider" />
              <Link className="button button-quiet" href="/audit">
                See full decision receipt <ArrowRight size={12} />
              </Link>
            </aside>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon"><CheckCircle2 size={22} /></span>
            <h3>All caught up</h3>
            <p>Your agents are operating securely within the configured safety ceilings.</p>
            <button className="button button-secondary" type="button" onClick={resetQueue} style={{ marginTop: 14 }}>
              <Undo2 size={13} /> Reset demonstration queue
            </button>
          </div>
        )}
      </div>

      {queue.length > 0 && (
        <div className="content-grid">
          <section className="card card-pad">
            <SectionHeader title="Waiting for your review" subtitle="Select an item to inspect its details." />
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
                    borderColor: item.id === selectedId ? "var(--blue)" : "var(--line)",
                  }}
                >
                  <span className="merchant-logo">{item.merchantInitials}</span>
                  <span className="decision-main">
                    <span className="decision-name">{item.merchant}</span>
                    <span className="decision-meta">{item.product} · ${item.amount.toFixed(2)}</span>
                  </span>
                  <ArrowRight size={13} className="muted" />
                </button>
              ))}
            </div>
          </section>
          <section className="card card-pad">
            <SectionHeader title="Recent decision actions" subtitle="Your latest approvals and blocks" />
            <div className="decision-list">
              <div className="decision-row">
                <span className="health-icon"><CheckCircle2 size={15} /></span>
                <div className="decision-main">
                  <div className="decision-name">Adobe CC Subscription</div>
                  <div className="decision-meta">Recently approved · CreativeCopilot</div>
                </div>
                <StatusPill tone="success">Approved</StatusPill>
              </div>
              <div className="decision-row">
                <span className="health-icon" style={{ background: "var(--red-soft)", color: "var(--red)" }}><X size={14} /></span>
                <div className="decision-main">
                  <div className="decision-name">Unverified Cloud Hosting</div>
                  <div className="decision-meta">Blocked by merchant trust policy</div>
                </div>
                <StatusPill tone="danger">Blocked</StatusPill>
              </div>
            </div>
          </section>
        </div>
      )}
      {toast && <Toast message={toast} />}
    </>
  );
}
