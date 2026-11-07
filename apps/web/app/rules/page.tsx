"use client";

import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  CalendarDays,
  Check,
  CircleDollarSign,
  Info,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { PageHeading, SectionHeader, StatusPill, Toast, Toggle } from "@/components/ui";

const initialCategories = ["Electronics", "Software", "Office Supplies", "Travel"];
const blockedCategories = ["Gambling", "Crypto", "Adult", "Luxury Goods"];

export default function RulesPage() {
  const [strict, setStrict] = useState(true);
  const [merchantVerification, setMerchantVerification] = useState(true);
  const [returnPolicy, setReturnPolicy] = useState(true);
  const [dailyCap, setDailyCap] = useState("1000");
  const [transactionCap, setTransactionCap] = useState("250");
  const [humanApproval, setHumanApproval] = useState("100");
  const [selected, setSelected] = useState<string[]>(initialCategories);
  const [toast, setToast] = useState("");

  function toggleCategory(category: string) {
    setSelected((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  }

  function saveRules() {
    setToast("Your AgentGuard policy has been updated.");
    window.setTimeout(() => setToast(""), 2800);
  }

  return (
    <>
      <PageHeading
        eyebrow="Sentinel V2.4"
        title="Rules & Settings"
        description="Define what your AI agents can purchase and when human authorization is required."
        actions={
          <button className="button button-primary" type="button" onClick={saveRules}>
            <Check size={14} /> Save changes
          </button>
        }
      />

      <section className="policy-hero" style={{ marginBottom: 14 }}>
        <div className="rule-card-heading">
          <span className="rule-icon"><ShieldCheck size={18} /></span>
          <div className="rule-text">
            <h2 className="rule-title">Strict Enterprise Policy</h2>
            <p className="rule-copy">High-friction guardrails are active across autonomous payment calls.</p>
          </div>
          <StatusPill tone="success" icon={BadgeCheck}>Active</StatusPill>
        </div>
        <div className="divider" />
        <div className="rule-card-heading">
          <span className="rule-icon"><SlidersHorizontal size={16} /></span>
          <div className="rule-text">
            <h2 className="rule-title" style={{ fontSize: 11 }}>Policy mode</h2>
            <p className="rule-copy">{strict ? "Strict Autonomous Gate" : "Standard monitoring"}</p>
          </div>
          <Toggle checked={strict} onChange={() => setStrict((value) => !value)} label="Enable strict policy mode" />
        </div>
      </section>

      <div className="content-grid" style={{ alignItems: "start" }}>
        <div className="stack">
          <section className="card rule-card">
            <SectionHeader
              title="Budget & range limits"
              subtitle="Autonomous disbursement caps"
              action={<StatusPill tone="success">Active</StatusPill>}
            />
            <div className="field-row">
              <label>
                <span className="form-label">Per-transaction cap</span>
                <div className="search-wrap" style={{ width: "100%" }}>
                  <CircleDollarSign size={14} />
                  <input
                    className="input"
                    aria-label="Per-transaction cap"
                    value={transactionCap}
                    onChange={(event) => setTransactionCap(event.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <span className="section-subtitle">Instant limit per individual purchase</span>
              </label>
              <label>
                <span className="form-label">Daily total cap</span>
                <div className="search-wrap" style={{ width: "100%" }}>
                  <CircleDollarSign size={14} />
                  <input
                    className="input"
                    aria-label="Daily total cap"
                    value={dailyCap}
                    onChange={(event) => setDailyCap(event.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <span className="section-subtitle">$420 spent today</span>
              </label>
            </div>
            <div className="divider" />
            <div className="detail-row">
              <span>30-day velocity defense</span>
              <strong style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span className="status-pill success">Enabled · 99.4%</span>
                <button className="button button-quiet" type="button" aria-label="Configure velocity defense">
                  <SlidersHorizontal size={13} />
                </button>
              </strong>
            </div>
          </section>

          <section className="card rule-card">
            <SectionHeader
              title="Category whitelist"
              subtitle="Product and service taxonomies"
              action={<StatusPill tone="info">{selected.length} allowed</StatusPill>}
            />
            <div className="rule-copy" style={{ marginBottom: 10 }}>Permitted categories</div>
            <div className="chip-row">
              {initialCategories.map((category) => (
                <button
                  className={`chip${selected.includes(category) ? " selected" : ""}`}
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  aria-pressed={selected.includes(category)}
                >
                  {selected.includes(category) ? <Check size={12} /> : <span aria-hidden="true">+</span>}
                  {category}
                </button>
              ))}
            </div>
            <div className="divider" />
            <div className="rule-copy" style={{ marginBottom: 10 }}>Strictly restricted · hard block</div>
            <div className="chip-row">
              {blockedCategories.map((category) => (
                <span className="chip" key={category} style={{ color: "var(--red)" }}>
                  <Ban size={12} /> {category}
                </span>
              ))}
            </div>
          </section>

          <section className="card rule-card">
            <div className="rule-card-heading">
              <span className="rule-icon"><Undo2 size={18} /></span>
              <div className="rule-text">
                <h2 className="rule-title">Return policy safeguard</h2>
                <p className="rule-copy">Autonomous dispute buffer · require a valid refund and return window.</p>
              </div>
              <Toggle checked={returnPolicy} onChange={() => setReturnPolicy((value) => !value)} label="Require return policy" />
            </div>
            <div className="divider" />
            <div className="detail-row">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <CalendarDays size={13} /> Minimum return window
              </span>
              <strong>14+ days</strong>
            </div>
            <div className="agent-health" style={{ marginTop: 12, background: "var(--blue-soft)" }}>
              <Info size={15} color="var(--blue)" />
              <div className="health-subtitle" style={{ margin: 0 }}>
                AgentGuard checks checkout terms. “All sales final” or shorter windows pause for review.
              </div>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card rule-card">
            <SectionHeader
              title="Merchant trust & rating"
              subtitle="Vendor verification protocols"
              action={<StatusPill tone="warning">Guarded</StatusPill>}
            />
            <label>
              <span className="form-label">Minimum merchant score</span>
              <select className="select" defaultValue="4.2" aria-label="Minimum merchant rating">
                <option value="3.5">3.5 / 5.0</option>
                <option value="4.0">4.0 / 5.0</option>
                <option value="4.2">4.2 / 5.0</option>
                <option value="4.5">4.5 / 5.0</option>
                <option value="5">5.0 / 5.0</option>
              </select>
            </label>
            <div className="divider" />
            <div className="rule-card-heading">
              <span className="rule-icon"><LockKeyhole size={17} /></span>
              <div className="rule-text">
                <h3 className="rule-title" style={{ fontSize: 11 }}>Verified PayPal merchants only</h3>
                <p className="rule-copy">Unverified sellers pause for manual sign-off.</p>
              </div>
              <Toggle
                checked={merchantVerification}
                onChange={() => setMerchantVerification((value) => !value)}
                label="Require verified PayPal merchant"
              />
            </div>
            <div className="chip-row" style={{ marginTop: 12 }}>
              <span className="chip selected"><Star size={12} fill="currentColor" /> 4.2+ score</span>
              <span className="chip"><BadgeCheck size={12} /> Verified status</span>
            </div>
          </section>

          <section className="card rule-card">
            <SectionHeader
              title="Human approval threshold"
              subtitle="Mandatory operator intervention"
              action={<StatusPill tone="success">Enforced</StatusPill>}
            />
            <div className="rule-copy" style={{ marginBottom: 10 }}>Auto-intercept trigger</div>
            <div className="search-wrap" style={{ width: "100%" }}>
              <AlertTriangle size={14} />
              <input
                className="input"
                aria-label="Human approval amount threshold"
                value={humanApproval}
                onChange={(event) => setHumanApproval(event.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="agent-health" style={{ marginTop: 13, background: "var(--amber-soft)" }}>
              <AlertTriangle size={15} color="var(--amber)" />
              <div className="health-subtitle" style={{ margin: 0 }}>
                Purchases over ${humanApproval || "0"} or from a first-time vendor wait for your sign-off.
              </div>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={saveRules}
              style={{ width: "100%", marginTop: 13 }}
            >
              Save approval threshold <ArrowRight size={13} />
            </button>
          </section>

          <section className="card card-pad">
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <Info size={15} color="var(--blue)" />
              <p className="section-subtitle" style={{ margin: 0 }}>
                Changes take effect on all agent runtime sessions in real time. PayPal Zero-Liability coverage remains active.
              </p>
            </div>
          </section>
        </div>
      </div>
      {toast && <Toast message={toast} />}
    </>
  );
}
