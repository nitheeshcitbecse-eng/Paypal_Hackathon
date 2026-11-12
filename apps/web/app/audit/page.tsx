"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileCheck2,
  LoaderCircle,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ApiNotice, LoadingState, PageHeading, SectionHeader, StatusPill, Toast } from "@/components/ui";
import { ReceiptChecks } from "@/components/receipt-checks";
import { api } from "@/lib/api";
import { AWAITING_CAPTURE, decisionTone, formatDate, paymentLabel, usd } from "@/lib/format";
import { messageOf, useApi, useToast } from "@/lib/hooks";
import type { Decision, Transaction } from "@/lib/types";

const filterOptions: ("All" | Decision)[] = ["All", "Approved", "Held", "Blocked"];

const loadLedger = () => api.transactions({ limit: 500 });

function pct(part: number, total: number) {
  return total ? `${Math.round((100 * part) / total)}% of requests` : "No requests yet";
}

export default function AuditPage() {
  const { data, error, loading, reload } = useApi(loadLedger);
  const [filter, setFilter] = useState<(typeof filterOptions)[number]>("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const { toast, show } = useToast();

  const transactions = useMemo(() => data ?? [], [data]);
  const selected = transactions.find((item) => item.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const result = { Approved: 0, Held: 0, Blocked: 0 };
    for (const item of transactions) result[item.status] += 1;
    return result;
  }, [transactions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesStatus = filter === "All" || transaction.status === filter;
      const matchesQuery =
        !query ||
        [transaction.merchant, transaction.product, transaction.agent, transaction.id, transaction.receiptId, transaction.category]
          .some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [transactions, filter, search]);

  function exportCsv() {
    const rows = [
      ["Transaction ID", "Receipt ID", "Merchant", "Product", "Agent", "Amount", "Status", "Payment", "PayPal order", "Date", "Reason"],
      ...filtered.map((item) => [
        item.id,
        item.receiptId,
        item.merchant,
        item.product,
        item.agent,
        `${item.currency} ${item.amount.toFixed(2)}`,
        item.status,
        paymentLabel(item.paymentStatus),
        item.paypalOrderId ?? "",
        item.date,
        item.reason,
      ]),
    ];
    const csv = rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "agentguard-audit-ledger.csv";
    link.click();
    URL.revokeObjectURL(url);
    show("Audit ledger exported as CSV.");
  }

  async function copyReceipt(transaction: Transaction) {
    const receipt = [
      `Receipt: ${transaction.receiptId}`,
      `Transaction: ${transaction.id}`,
      `Date: ${transaction.date}`,
      `Agent: ${transaction.agent}`,
      `Task: ${transaction.task}`,
      `Purchase: ${transaction.product} from ${transaction.merchant} for ${usd(transaction.amount)}`,
      `Decision: ${transaction.status.toUpperCase()} (${transaction.receipt.headline})`,
      `PayPal order: ${transaction.paypalOrderId ?? "none"} (${paymentLabel(transaction.paymentStatus)})`,
      `Explanation: ${transaction.reason}`,
      "Checks:",
      ...transaction.receipt.checks.map((check) => `  [${check.passed ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`),
    ].join("\n");

    if (!navigator.clipboard) {
      show("Clipboard access is unavailable in this browser.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(receipt);
      show("Receipt details copied to clipboard.");
    } catch (err) {
      show(err instanceof Error ? `Could not copy receipt: ${err.message}` : "Could not copy receipt details.", "error");
    }
  }

  async function capture(transaction: Transaction) {
    setCapturing(true);
    try {
      const updated = await api.capture(transaction.id);
      show(`Payment ${paymentLabel(updated.paymentStatus).toLowerCase()} on PayPal.`);
      reload();
    } catch (err) {
      show(messageOf(err), "error");
    } finally {
      setCapturing(false);
    }
  }

  const canCapture = selected && selected.status === "Approved" && AWAITING_CAPTURE.has(selected.paymentStatus ?? "");

  return (
    <>
      <PageHeading
        eyebrow="Decision ledger"
        title="Audit Ledger"
        description="A clear, searchable record of every purchase decision made by your AI agents."
        actions={
          <>
            <button className="button button-quiet" type="button" onClick={reload}>
              <RotateCcw size={13} /> Refresh
            </button>
            <button className="button button-secondary" type="button" onClick={exportCsv} disabled={filtered.length === 0}>
              <ArrowDownToLine size={14} /> Export CSV
            </button>
          </>
        }
      />

      {error && <ApiNotice message={error} onRetry={reload} />}

      <section className="metric-grid" aria-label="Audit summary">
        <div className="card metric-card">
          <div className="metric-label">Total decisions</div>
          <div className="metric-icon"><FileCheck2 size={16} /></div>
          <div className="metric-value">{transactions.length}</div>
          <div className="metric-foot">All time</div>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Approved</div>
          <div className="metric-icon"><CheckCircle2 size={16} /></div>
          <div className="metric-value">{counts.Approved}</div>
          <div className="metric-foot positive">{pct(counts.Approved, transactions.length)}</div>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Held for review</div>
          <div className="metric-icon"><Clock3 size={16} /></div>
          <div className="metric-value">{counts.Held}</div>
          <div className="metric-foot">Human authorization required</div>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Blocked</div>
          <div className="metric-icon"><ShieldAlert size={16} /></div>
          <div className="metric-value">{counts.Blocked}</div>
          <div className="metric-foot">Policy rules enforced</div>
        </div>
      </section>

      <section className="card card-pad" style={{ marginTop: 16 }}>
        <SectionHeader
          title="Transaction history"
          subtitle="Select a row to inspect the full decision receipt."
          action={<StatusPill tone="neutral">{filtered.length} shown</StatusPill>}
        />
        <div className="filters-row" style={{ marginBottom: 15 }}>
          <div className="search-wrap" style={{ flex: "1 1 210px" }}>
            <Search size={14} />
            <input
              className="input"
              aria-label="Search audit ledger"
              placeholder="Search merchant, agent, or ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="filters-row" aria-label="Filter by decision">
            {filterOptions.map((option) => (
              <button
                className={`chip${filter === option ? " selected" : ""}`}
                key={option}
                type="button"
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        {!data && loading ? (
          <LoadingState />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Merchant / item</th>
                  <th>Agent</th>
                  <th>Amount</th>
                  <th>Decision</th>
                  <th>Date</th>
                  <th aria-label="Open receipt" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    style={{ cursor: "pointer" }}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") setSelectedId(item.id);
                    }}
                  >
                    <td className="muted">{item.id}</td>
                    <td>
                      <div className="merchant-cell">
                        <span className="merchant-logo">{item.merchantInitials}</span>
                        <span>
                          <span className="merchant-name">{item.merchant}</span>
                          <span className="merchant-meta">{item.product}</span>
                        </span>
                      </div>
                    </td>
                    <td>{item.agent}</td>
                    <td style={{ fontWeight: 650 }}>{usd(item.amount)}</td>
                    <td><StatusPill tone={decisionTone[item.status]}>{item.status}</StatusPill></td>
                    <td className="muted">{formatDate(item.date)}</td>
                    <td><ArrowRight size={13} className="muted" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state">
                <span className="empty-state-icon"><Search size={20} /></span>
                <h3>{transactions.length === 0 ? "No decisions yet" : "No matching decisions"}</h3>
                <p>
                  {transactions.length === 0
                    ? "Run a task in the playground and its decision receipt will appear here."
                    : "Try a different search term or select another decision filter."}
                </p>
              </div>
            )}
          </div>
        )}
        <div className="divider" />
        <div className="section-subtitle" style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <CircleDollarSign size={13} /> Receipts are built from the actual check results, so they always match what happened.
        </div>
      </section>

      {selected && (
        <>
          <button className="receipt-backdrop" type="button" aria-label="Close receipt" onClick={() => setSelectedId(null)} />
          <aside className="receipt-panel" aria-label="Decision receipt">
            <div className="section-header">
              <div>
                <div className="eyebrow">Transaction receipt</div>
                <h2 className="section-title" style={{ fontSize: 19 }}>Decision details</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setSelectedId(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="agent-health" style={{ background: `var(--${selected.status === "Approved" ? "green" : selected.status === "Held" ? "amber" : "red"}-soft)` }}>
              <span className="health-icon">
                {selected.status === "Approved" ? <CheckCircle2 size={17} /> : selected.status === "Held" ? <Clock3 size={17} /> : <ShieldAlert size={17} />}
              </span>
              <div>
                <div className="health-title">
                  {selected.approvalStatus === "approved"
                    ? "Approved by you"
                    : selected.approvalStatus === "rejected"
                      ? "Declined by you"
                      : `${selected.status} by AgentGuard`}
                </div>
                <div className="health-subtitle">
                  {formatDate(selected.date)}
                  {selected.decidedAt ? ` · decided ${formatDate(selected.decidedAt)}` : ""}
                </div>
              </div>
            </div>
            <div style={{ padding: "19px 0" }}>
              <div className="merchant-cell">
                <span className="merchant-logo large">{selected.merchantInitials}</span>
                <span>
                  <span className="merchant-name" style={{ fontSize: 13 }}>{selected.merchant}</span>
                  <span className="merchant-meta">{selected.product}</span>
                </span>
              </div>
              <div className="queue-amount" style={{ marginTop: 17 }}>
                {usd(selected.amount)}<small>{selected.currency}</small>
              </div>
            </div>
            <div className="detail-row"><span>Transaction ID</span><strong>{selected.id}</strong></div>
            <div className="detail-row"><span>Agent</span><strong>{selected.agent}</strong></div>
            <div className="detail-row"><span>Category</span><strong>{selected.category}</strong></div>
            <div className="detail-row"><span>PayPal order</span><strong>{selected.paypalOrderId ?? "Not created"}</strong></div>
            <div className="detail-row"><span>Payment</span><strong>{paymentLabel(selected.paymentStatus)}</strong></div>
            {selected.decisionNote && <div className="detail-row"><span>Your note</span><strong>{selected.decisionNote}</strong></div>}
            {canCapture && (
              <div style={{ marginTop: 12 }}>
                {selected.approveUrl && (
                  <a className="button button-quiet" href={selected.approveUrl} target="_blank" rel="noreferrer" style={{ paddingLeft: 0 }}>
                    1. Approve as PayPal Sandbox buyer <ExternalLink size={12} />
                  </a>
                )}
                <button className="button button-success" type="button" style={{ width: "100%", marginTop: 6 }} onClick={() => capture(selected)} disabled={capturing}>
                  {capturing ? <LoaderCircle size={13} className="spin" /> : <CircleDollarSign size={13} />} {selected.approveUrl ? "2. " : ""}Capture payment
                </button>
              </div>
            )}
            <div className="divider" />
            <SectionHeader title="Policy explanation" subtitle="Why AgentGuard made this decision" />
            <div className="reason-box" style={{ marginTop: 0, marginBottom: 14 }}>
              <div className="reason-label"><FileCheck2 size={13} /> {selected.receipt.headline}</div>
              <p className="reason-copy">{selected.reason}</p>
            </div>
            <div className="rule-copy" style={{ marginBottom: 8 }}>Task: “{selected.task}”</div>
            <ReceiptChecks checks={selected.receipt.checks} />
            <div className="divider" />
            <SectionHeader title="Receipt" />
            <div className="receipt-code">
              Receipt: {selected.receiptId}<br />
              Transaction: {selected.id}<br />
              Subject: {selected.agent}<br />
              Decision: {selected.status.toUpperCase()}<br />
              PayPal order: {selected.paypalOrderId ?? "none"}<br />
              Issued: {selected.receipt.created_at}
            </div>
            <button className="button button-secondary" type="button" style={{ width: "100%", marginTop: 19 }} onClick={() => copyReceipt(selected)}>
              <FileCheck2 size={13} /> Copy receipt details
            </button>
          </aside>
        </>
      )}
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </>
  );
}
