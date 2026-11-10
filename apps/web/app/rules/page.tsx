"use client";

import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CircleDollarSign,
  Info,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeading, SectionHeader, StatusPill, Toast, Toggle } from "@/components/ui";
import { getRules, saveRules as updateRules, type RuleSet } from "@/lib/api";

export default function RulesPage() {
  const [strict, setStrict] = useState(false);
  const [merchantVerification, setMerchantVerification] = useState(false);
  const [returnPolicy, setReturnPolicy] = useState(false);
  const [dailyCap, setDailyCap] = useState("");
  const [transactionCap, setTransactionCap] = useState("");
  const [humanApproval, setHumanApproval] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [toast, setToast] = useState("");
  const [hasRules, setHasRules] = useState(false);

  useEffect(() => {
    let active = true;
    void getRules()
      .then((rules) => {
        if (!active || !rules) return;
        setHasRules(true);
        setStrict(rules.strict);
        setMerchantVerification(rules.merchantVerification);
        setReturnPolicy(rules.returnPolicy);
        setDailyCap(String(rules.dailyCap ?? 0));
        setTransactionCap(String(rules.transactionCap ?? 0));
        setHumanApproval(String(rules.humanApproval ?? 0));
        setSelected(Array.isArray(rules.allowedCategories) ? rules.allowedCategories : []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  function toggleCategory(category: string) {
    setSelected((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  }

  function addCategory() {
    const category = categoryInput.trim();
    if (!category || selected.includes(category)) return;
    setSelected((current) => [...current, category]);
    setCategoryInput("");
  }

  async function saveRules() {
    const rules: RuleSet = {
      strict,
      merchantVerification,
      returnPolicy,
      dailyCap: Number(dailyCap) || 0,
      transactionCap: Number(transactionCap) || 0,
      humanApproval: Number(humanApproval) || 0,
      allowedCategories: selected,
    };
    try {
      const saved = await updateRules(rules);
      setHasRules(saved !== null);
      setToast("Your AgentGuard policy has been updated.");
      window.setTimeout(() => setToast(""), 2800);
    } catch {
      // The shared backend error dialog reports API failures.
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Sentinel V2.4"
        title="Rules & Settings"
        description="Define what your AI agents can purchase and when human authorization is required."
        actions={
          <button className="button button-primary" type="button" onClick={() => void saveRules()}>
            <Check size={14} /> Save changes
          </button>
        }
      />

      <section className="policy-hero" style={{ marginBottom: 14 }}>
        <div className="rule-card-heading">
          <span className="rule-icon"><ShieldCheck size={18} /></span>
          <div className="rule-text">
            <h2 className="rule-title">AgentGuard policy</h2>
            <p className="rule-copy">{hasRules ? "Guardrails loaded from the backend." : "No guardrails are configured yet."}</p>
          </div>
          <StatusPill tone={hasRules ? "success" : "neutral"} icon={hasRules ? BadgeCheck : undefined}>{hasRules ? "Configured" : "Not configured"}</StatusPill>
        </div>
        <div className="divider" />
        <div className="rule-card-heading">
          <span className="rule-icon"><SlidersHorizontal size={16} /></span>
          <div className="rule-text">
            <h2 className="rule-title" style={{ fontSize: 11 }}>Policy mode</h2>
            <p className="rule-copy">{hasRules ? (strict ? "Strict Autonomous Gate" : "Standard monitoring") : "No policy mode configured"}</p>
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
              action={<StatusPill tone={hasRules ? "success" : "neutral"}>{hasRules ? "Configured" : "Not configured"}</StatusPill>}
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
                <span className="section-subtitle">$0.00 spent today</span>
              </label>
            </div>
            <div className="divider" />
            <div className="detail-row">
              <span>30-day velocity defense</span>
              <strong>{hasRules ? "Configured" : "Not configured"}</strong>
            </div>
          </section>

          <section className="card rule-card">
            <SectionHeader
              title="Category whitelist"
              subtitle="Product and service taxonomies"
              action={<StatusPill tone="info">{selected.length} allowed</StatusPill>}
            />
            <div className="rule-copy" style={{ marginBottom: 10 }}>Permitted categories</div>
            {selected.length > 0 ? <div className="chip-row">
              {selected.map((category) => (
                <button
                  className="chip selected"
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  aria-pressed="true"
                >
                  <Check size={12} />
                  {category}
                </button>
              ))}
            </div> : <p className="section-subtitle">No allowed categories configured.</p>}
            <div className="field-row" style={{ alignItems: "end", marginTop: 12 }}>
              <label>
                <span className="form-label">Add permitted category</span>
                <input
                  className="input"
                  aria-label="New allowed category"
                  value={categoryInput}
                  onChange={(event) => setCategoryInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCategory();
                    }
                  }}
                />
              </label>
              <button className="button button-secondary" type="button" onClick={addCategory}>
                Add category
              </button>
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
              <strong>{hasRules && returnPolicy ? "Required" : "Not configured"}</strong>
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
              action={<StatusPill tone={merchantVerification ? "success" : "neutral"}>{merchantVerification ? "Enabled" : "Disabled"}</StatusPill>}
            />
            <p className="section-subtitle">Minimum merchant score is not configured.</p>
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
              <span className="chip"><BadgeCheck size={12} /> Merchant verification {merchantVerification ? "on" : "off"}</span>
            </div>
          </section>

          <section className="card rule-card">
            <SectionHeader
              title="Human approval threshold"
              subtitle="Mandatory operator intervention"
              action={<StatusPill tone={hasRules ? "success" : "neutral"}>{hasRules ? "Enforced" : "Not configured"}</StatusPill>}
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
                Purchases over ${Number(humanApproval) || 0} or from a first-time vendor wait for your sign-off.
              </div>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void saveRules()}
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
