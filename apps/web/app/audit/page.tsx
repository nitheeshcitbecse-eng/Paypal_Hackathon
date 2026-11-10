"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeading, SectionHeader, StatusPill, Toast } from "@/components/ui";
import { getOrder, getOrders, type Decision, type Transaction } from "@/lib/api";

const filterOptions: ("All" | Decision)[] = ["All", "Approved", "Held", "Blocked"];

const decisionTone: Record<Decision, "success" | "warning" | "danger"> = {
  Approved: "success",
  Held: "warning",
  Blocked: "danger",
};

export default function AuditPage() {
  const [filter, setFilter] = useState<(typeof filterOptions)[number]>("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [toast, setToast] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    let active = true;
    void getOrders()
      .then((items) => {
        if (active) setTransactions(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesStatus = filter === "All" || transaction.status === filter;
      const matchesQuery =
        !query ||
        [transaction.merchant, transaction.product, transaction.agent, transaction.id]
          .some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [filter, search, transactions]);

  const approvedCount = transactions.filter((item) => item.status === "Approved").length;
  const heldCount = transactions.filter((item) => item.status === "Held").length;
  const blockedCount = transactions.filter((item) => item.status === "Blocked").length;

  async function openReceipt(transaction: Transaction) {
    try {
      setSelected((await getOrder(transaction.id)) ?? transaction);
    } catch {
      // The shared backend error dialog reports API failures.
    }
  }

  function exportCsv() {
    const rows = [
      ["Transaction ID", "Merchant", "Product", "Agent", "Amount", "Status", "Date", "Reason"],
      ...filtered.map((item) => [
        item.id,
        item.merchant,
        item.product,
        item.agent,
        `${item.currency} ${item.amount.toFixed(2)}`,
        item.status,
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
    setToast("Audit ledger exported as CSV.");
    window.setTimeout(() => setToast(""), 2600);
  }

  async function copyReceipt(transaction: Transaction) {
    const receipt = [
      `Receipt: ${transaction.receiptId}`,
      `Transaction: ${transaction.id}`,
      `Policy: Sentinel V2.4`,
      `Agent: ${transaction.agent}`,
      `Decision: ${transaction.status.toUpperCase()}`,
      `Explanation: ${transaction.reason}`,
    ].join("\n");

    if (!navigator.clipboard) {
      setToast("Clipboard access is unavailable in this browser.");
      return;
    }

    try {
      await navigator.clipboard.writeText(receipt);
      setToast("Receipt details copied to clipboard.");
    } catch (error) {
      setToast(
        error instanceof Error
          ? `Could not copy receipt: ${error.message}`
          : "Could not copy receipt details.",
      );
    }
    window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <>
      <PageHeading
        eyebrow="Decision ledger"
        title="Audit Ledger"
        description="A clear, searchable record of every purchase decision made by your AI agents."
        actions={
          <button className="button button-secondary" type="button" onClick={exportCsv}>
            <ArrowDownToLine size={14} /> Export CSV
          </button>
        }
      />

      <section className="metric-grid" aria-label="Audit summary">
        <div className="card metric-card">
          <div className="metric-label">Total decisions</div>
          <div className="metric-icon"><FileCheck2 size={16} /></div>
          <div className="metric-value">{transactions.length}</div>
          <div className="metric-foot">Total decisions</div>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Approved</div>
          <div className="metric-icon"><CheckCircle2 size={16} /></div>
          <div className="metric-value">{approvedCount}</div>
          <div className="metric-foot positive">{transactions.length ? `${Math.round(approvedCount / transactions.length * 100)}% of requests` : "No requests yet"}</div>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Held for review</div>
          <div className="metric-icon"><Clock3 size={16} /></div>
          <div className="metric-value">{heldCount}</div>
          <div className="metric-foot">Human authorization required</div>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Blocked</div>
          <div className="metric-icon"><ShieldAlert size={16} /></div>
          <div className="metric-value">{blockedCount}</div>
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
                {option === "All" && <ChevronDown size={11} />}
              </button>
            ))}
          </div>
        </div>
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
                  onClick={() => void openReceipt(item)}
                  style={{ cursor: "pointer" }}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void openReceipt(item);
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
                  <td style={{ fontWeight: 650 }}>${item.amount.toFixed(2)}</td>
                  <td><StatusPill tone={decisionTone[item.status]}>{item.status}</StatusPill></td>
                  <td className="muted">{item.date}</td>
                  <td><ArrowRight size={13} className="muted" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty-state">
              <span className="empty-state-icon"><Search size={20} /></span>
              <h3>{transactions.length === 0 ? "No decisions yet" : "No matching decisions"}</h3>
              <p>{transactions.length === 0
                ? "No active transactions found. Use the Agent tab to initiate a purchase request and populate data in real time."
                : "Try a different search term or select another decision filter."}</p>
            </div>
          )}
        </div>
        <div className="divider" />
        <div className="section-subtitle" style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <CircleDollarSign size={13} /> Decision receipts are tamper-evident records of agent checkout activity.
        </div>
      </section>

      {selected && (
        <>
          <button className="receipt-backdrop" type="button" aria-label="Close receipt" onClick={() => setSelected(null)} />
          <aside className="receipt-panel" aria-label="Decision receipt">
            <div className="section-header">
              <div>
                <div className="eyebrow">Transaction receipt</div>
                <h2 className="section-title" style={{ fontSize: 19 }}>Decision details</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setSelected(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="agent-health" style={{ background: `var(--${selected.status === "Approved" ? "green" : selected.status === "Held" ? "amber" : "red"}-soft)` }}>
              <span className="health-icon">
                {selected.status === "Approved" ? <CheckCircle2 size={17} /> : selected.status === "Held" ? <Clock3 size={17} /> : <ShieldAlert size={17} />}
              </span>
              <div>
                <div className="health-title">{selected.status} by AgentGuard</div>
                <div className="health-subtitle">{selected.date}</div>
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
                ${selected.amount.toFixed(2)}<small>{selected.currency}</small>
              </div>
            </div>
            <div className="detail-row"><span>Transaction ID</span><strong>{selected.id}</strong></div>
            <div className="detail-row"><span>Agent</span><strong>{selected.agent}</strong></div>
            <div className="detail-row"><span>Category</span><strong>{selected.category}</strong></div>
            <div className="detail-row"><span>Merchant</span><strong>Verified PayPal merchant</strong></div>
            <div className="divider" />
            <SectionHeader title="Policy explanation" subtitle="Why AgentGuard made this decision" />
            <div className="reason-box" style={{ marginTop: 0, marginBottom: 18 }}>
              <div className="reason-label"><FileCheck2 size={13} /> Rule evaluation</div>
              <p className="reason-copy">{selected.reason}</p>
            </div>
            <SectionHeader title="Tamper-evident receipt" />
            <div className="receipt-code">
              Receipt: {selected.receiptId}<br />
              Policy: Sentinel V2.4<br />
              Subject: {selected.agent}<br />
              Decision: {selected.status.toUpperCase()}<br />
              Signature: sha256:7f93c2a8...d0a6
            </div>
            <button className="button button-secondary" type="button" style={{ width: "100%", marginTop: 19 }} onClick={() => copyReceipt(selected)}>
              <FileCheck2 size={13} /> Copy receipt details
            </button>
          </aside>
        </>
      )}
      {toast && <Toast message={toast} />}
    </>
  );
}
