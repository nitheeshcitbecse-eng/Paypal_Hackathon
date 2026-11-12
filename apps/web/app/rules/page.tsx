"use client";

import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  Check,
  CircleDollarSign,
  Info,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RotateCcw,
  ShieldCheck,
  Star,
  Store,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiNotice, LoadingState, PageHeading, SectionHeader, StatusPill, Toast, Toggle } from "@/components/ui";
import { api } from "@/lib/api";
import { usd } from "@/lib/format";
import { messageOf, useApi, useToast } from "@/lib/hooks";
import type { Merchant, RuleSettings } from "@/lib/types";

const suggestedCategories = ["Electronics", "Accessories", "Books", "Home", "Software", "Office Supplies", "Travel"];
const blockedExamples = ["Gift cards", "Gambling", "Crypto", "Luxury Goods"];
const ratingOptions = [3.5, 4.0, 4.2, 4.5, 5.0];

async function loadRules() {
  const [rules, merchants] = await Promise.all([api.rules(), api.merchants()]);
  return { rules, merchants };
}

export default function RulesPage() {
  const { data, error, loading, reload } = useApi(loadRules);

  return (
    <>
      {error && <ApiNotice message={error} onRetry={reload} />}
      {data ? (
        <RulesEditor initialRules={data.rules} initialMerchants={data.merchants} />
      ) : (
        <>
          <PageHeading eyebrow="Policy" title="Rules & Settings" description="Define what your AI agents can purchase and when human authorization is required." />
          {loading && <LoadingState />}
        </>
      )}
    </>
  );
}

function sameCategory(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function RulesEditor({ initialRules, initialMerchants }: { initialRules: RuleSettings; initialMerchants: Merchant[] }) {
  const [rules, setRules] = useState(initialRules);
  const [transactionCap, setTransactionCap] = useState(String(initialRules.max_per_order));
  const [totalBudget, setTotalBudget] = useState(String(initialRules.total_budget));
  const [humanApproval, setHumanApproval] = useState(String(initialRules.approval_limit));
  const [minRating, setMinRating] = useState(initialRules.min_merchant_rating);
  const [returnPolicy, setReturnPolicy] = useState(initialRules.require_return_policy);
  const [selected, setSelected] = useState<string[]>(initialRules.allowed_categories);
  const [categories, setCategories] = useState<string[]>(() => {
    const all = [...suggestedCategories];
    for (const category of initialRules.allowed_categories) {
      if (!all.some((existing) => sameCategory(existing, category))) all.push(category);
    }
    return all;
  });
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();

  const ratingChoices = ratingOptions.includes(minRating) ? ratingOptions : [...ratingOptions, minRating].sort((a, b) => a - b);

  function isSelected(category: string) {
    return selected.some((value) => sameCategory(value, category));
  }

  function toggleCategory(category: string) {
    setSelected((current) =>
      current.some((value) => sameCategory(value, category))
        ? current.filter((value) => !sameCategory(value, category))
        : [...current, category],
    );
  }

  function addCategory(event: FormEvent) {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    if (!categories.some((value) => sameCategory(value, name))) setCategories((current) => [...current, name]);
    if (!isSelected(name)) setSelected((current) => [...current, name]);
    setNewCategory("");
  }

  async function saveRules() {
    const maxPerOrder = Number(transactionCap);
    const budget = Number(totalBudget);
    const approval = Number(humanApproval);
    if (!(maxPerOrder > 0) || !(budget > 0)) {
      show("The per-transaction cap and total budget must be numbers greater than 0.", "error");
      return;
    }
    if (!(approval >= 0)) {
      show("The approval threshold must be a number of 0 or more.", "error");
      return;
    }
    setSaving(true);
    try {
      const saved = await api.updateRules({
        max_per_order: maxPerOrder,
        total_budget: budget,
        approval_limit: approval,
        allowed_categories: selected,
        min_merchant_rating: minRating,
        require_return_policy: returnPolicy,
      });
      setRules(saved);
      setSelected(saved.allowed_categories);
      show("Your AgentGuard policy has been updated.");
    } catch (error) {
      show(messageOf(error), "error");
    } finally {
      setSaving(false);
    }
  }

  async function resetSpend() {
    try {
      setRules(await api.resetSpend());
      show("Spending counter reset to $0.00.");
    } catch (error) {
      show(messageOf(error), "error");
    }
  }

  const saveButton = (
    <button className="button button-primary" type="button" onClick={saveRules} disabled={saving}>
      {saving ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Save changes
    </button>
  );

  return (
    <>
      <PageHeading
        eyebrow="Policy"
        title="Rules & Settings"
        description="Define what your AI agents can purchase and when human authorization is required."
        actions={saveButton}
      />

      <section className="policy-hero" style={{ marginBottom: 14 }}>
        <div className="rule-card-heading">
          <span className="rule-icon"><ShieldCheck size={18} /></span>
          <div className="rule-text">
            <h2 className="rule-title">AI proposes. Rules decide.</h2>
            <p className="rule-copy">Every purchase must pass the AI safety check and every rule below. Any failure blocks it.</p>
          </div>
          <StatusPill tone="success" icon={BadgeCheck}>Active</StatusPill>
        </div>
        <div className="divider" />
        <div className="rule-card-heading">
          <span className="rule-icon"><LockKeyhole size={16} /></span>
          <div className="rule-text">
            <h2 className="rule-title" style={{ fontSize: 11 }}>Fail-closed</h2>
            <p className="rule-copy">If the AI safety check cannot run, AgentGuard blocks the purchase instead of guessing.</p>
          </div>
          <StatusPill tone="info">Always on</StatusPill>
        </div>
      </section>

      <div className="content-grid" style={{ alignItems: "start" }}>
        <div className="stack">
          <section className="card rule-card">
            <SectionHeader
              title="Budget & range limits"
              subtitle="Autonomous spending caps"
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
                <span className="section-subtitle">Orders above this are blocked</span>
              </label>
              <label>
                <span className="form-label">Total budget</span>
                <div className="search-wrap" style={{ width: "100%" }}>
                  <CircleDollarSign size={14} />
                  <input
                    className="input"
                    aria-label="Total budget"
                    value={totalBudget}
                    onChange={(event) => setTotalBudget(event.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <span className="section-subtitle">{usd(rules.spent_so_far)} spent so far</span>
              </label>
            </div>
            <div className="divider" />
            <div className="detail-row">
              <span>Remaining budget</span>
              <strong style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                {usd(Math.max(rules.total_budget - rules.spent_so_far, 0))}
                <button className="button button-quiet" type="button" onClick={resetSpend} aria-label="Reset spending counter">
                  <RotateCcw size={13} /> Reset
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
              {categories.map((category) => (
                <button
                  className={`chip${isSelected(category) ? " selected" : ""}`}
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  aria-pressed={isSelected(category)}
                >
                  {isSelected(category) ? <Check size={12} /> : <span aria-hidden="true">+</span>}
                  {category}
                </button>
              ))}
            </div>
            <form className="filters-row" style={{ marginTop: 12 }} onSubmit={addCategory}>
              <input
                className="input"
                style={{ flex: "1 1 160px" }}
                aria-label="New category"
                placeholder="Add a category..."
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
              />
              <button className="button button-secondary" type="submit"><Plus size={13} /> Add</button>
            </form>
            <div className="divider" />
            <div className="rule-copy" style={{ marginBottom: 10 }}>Anything not on the list is blocked, for example</div>
            <div className="chip-row">
              {blockedExamples.filter((category) => !isSelected(category)).map((category) => (
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
                <p className="rule-copy">Only buy from merchants that offer returns.</p>
              </div>
              <Toggle checked={returnPolicy} onChange={() => setReturnPolicy((value) => !value)} label="Require return policy" />
            </div>
            <div className="agent-health" style={{ marginTop: 12, background: "var(--blue-soft)" }}>
              <Info size={15} color="var(--blue)" />
              <div className="health-subtitle" style={{ margin: 0 }}>
                {returnPolicy
                  ? "Merchants without a return policy in the registry are blocked."
                  : "Return policies are not checked."}
              </div>
            </div>
          </section>

          <MerchantRegistry initialMerchants={initialMerchants} minRating={minRating} requireReturns={returnPolicy} onToast={show} />
        </div>

        <div className="stack">
          <section className="card rule-card">
            <SectionHeader
              title="Merchant trust & rating"
              subtitle="Vendor verification"
              action={<StatusPill tone="warning">Guarded</StatusPill>}
            />
            <label>
              <span className="form-label">Minimum merchant score</span>
              <select
                className="select"
                value={String(minRating)}
                onChange={(event) => setMinRating(Number(event.target.value))}
                aria-label="Minimum merchant rating"
              >
                {ratingChoices.map((value) => (
                  <option key={value} value={String(value)}>{value.toFixed(1)} / 5.0</option>
                ))}
              </select>
            </label>
            <div className="divider" />
            <div className="rule-card-heading">
              <span className="rule-icon"><LockKeyhole size={17} /></span>
              <div className="rule-text">
                <h3 className="rule-title" style={{ fontSize: 11 }}>Registered merchants only</h3>
                <p className="rule-copy">Merchants missing from the registry are never trusted.</p>
              </div>
              <StatusPill tone="info">Always on</StatusPill>
            </div>
            <div className="chip-row" style={{ marginTop: 12 }}>
              <span className="chip selected"><Star size={12} fill="currentColor" /> {minRating.toFixed(1)}+ score</span>
              <span className="chip"><BadgeCheck size={12} /> In registry</span>
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
                Purchases over ${humanApproval || "0"} that pass every check are reserved on PayPal and wait for your sign-off.
              </div>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={saveRules}
              disabled={saving}
              style={{ width: "100%", marginTop: 13 }}
            >
              Save approval threshold <ArrowRight size={13} />
            </button>
          </section>

          <section className="card card-pad">
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <Info size={15} color="var(--blue)" />
              <p className="section-subtitle" style={{ margin: 0 }}>
                Saved changes apply to the next purchase any agent makes. Merchant registry changes apply immediately.
              </p>
            </div>
          </section>
        </div>
      </div>
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </>
  );
}

function MerchantRegistry({
  initialMerchants,
  minRating,
  requireReturns,
  onToast,
}: {
  initialMerchants: Merchant[];
  minRating: number;
  requireReturns: boolean;
  onToast: (message: string, tone?: "success" | "error") => void;
}) {
  const [merchants, setMerchants] = useState(initialMerchants);
  const [name, setName] = useState("");
  const [rating, setRating] = useState("4.5");
  const [hasReturns, setHasReturns] = useState(true);
  const [busy, setBusy] = useState(false);

  function edit(merchant: Merchant) {
    setName(merchant.name);
    setRating(String(merchant.rating));
    setHasReturns(merchant.has_return_policy);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const value = Number(rating);
    if (!name.trim()) return onToast("Enter a merchant name.", "error");
    if (!(value >= 0 && value <= 5)) return onToast("Rating must be between 0 and 5.", "error");
    setBusy(true);
    try {
      const saved = await api.upsertMerchant({ name: name.trim(), rating: value, has_return_policy: hasReturns });
      setMerchants((current) =>
        [...current.filter((m) => m.name.toLowerCase() !== saved.name.toLowerCase()), saved].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setName("");
      onToast(`${saved.name} saved to the merchant registry.`);
    } catch (error) {
      onToast(messageOf(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(merchant: Merchant) {
    try {
      await api.deleteMerchant(merchant.name);
      setMerchants((current) => current.filter((m) => m.name !== merchant.name));
      onToast(`${merchant.name} removed. Agents can no longer buy from it.`);
    } catch (error) {
      onToast(messageOf(error), "error");
    }
  }

  return (
    <section className="card rule-card">
      <SectionHeader
        title="Merchant registry"
        subtitle="Ratings and return policies used by the rules engine"
        action={<StatusPill tone="info">{merchants.length} merchants</StatusPill>}
      />
      <div className="decision-list">
        {merchants.map((merchant) => {
          const trusted = merchant.rating >= minRating && (!requireReturns || merchant.has_return_policy);
          return (
            <div className="decision-row" key={merchant.name}>
              <span className="health-icon"><Store size={14} /></span>
              <button
                type="button"
                className="decision-main"
                onClick={() => edit(merchant)}
                style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer", color: "inherit" }}
                aria-label={`Edit ${merchant.name}`}
              >
                <span className="decision-name" style={{ display: "block" }}>{merchant.name}</span>
                <span className="decision-meta">
                  {merchant.rating.toFixed(1)} / 5.0 · {merchant.has_return_policy ? "Has return policy" : "No return policy"}
                </span>
              </button>
              <StatusPill tone={trusted ? "success" : "danger"}>{trusted ? "Passes" : "Blocked"}</StatusPill>
              <button className="icon-button" type="button" aria-label={`Remove ${merchant.name}`} onClick={() => remove(merchant)}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="divider" />
      <form onSubmit={save}>
        <div className="rule-copy" style={{ marginBottom: 8 }}>Add or update a merchant</div>
        <div className="form-grid" style={{ marginTop: 0 }}>
          <input className="input" aria-label="Merchant name" placeholder="Merchant name" value={name} onChange={(event) => setName(event.target.value)} />
          <input className="input" aria-label="Merchant rating" placeholder="Rating 0-5" value={rating} onChange={(event) => setRating(event.target.value)} inputMode="decimal" />
        </div>
        <div className="detail-row" style={{ marginTop: 8 }}>
          <span>Offers a return policy</span>
          <Toggle checked={hasReturns} onChange={() => setHasReturns((value) => !value)} label="Merchant has a return policy" />
        </div>
        <button className="button button-secondary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
          {busy ? <LoaderCircle size={13} className="spin" /> : <Plus size={13} />} Save merchant
        </button>
      </form>
    </section>
  );
}
