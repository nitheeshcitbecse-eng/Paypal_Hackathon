// Shapes returned by the AgentGuard FastAPI backend (apps/api).

/** Raw engine decision. */
export type EngineDecision = "allowed" | "held" | "blocked";
/** Display status used across the dashboard. */
export type Decision = "Approved" | "Held" | "Blocked";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

export interface Receipt {
  decision: EngineDecision;
  headline: string;
  summary: string;
  checks: Check[];
  created_at: string;
}

export interface SafetyResult {
  intent_match: boolean;
  injection_detected: boolean;
  risk_reason: string;
}

export interface Transaction {
  id: string;
  merchant: string;
  merchantInitials: string;
  product: string;
  agent: string;
  amount: number;
  currency: string;
  date: string; // ISO-8601
  status: Decision;
  category: string;
  reason: string;
  receiptId: string;
  task: string;
  decision: EngineDecision;
  approvalStatus: ApprovalStatus | null;
  decidedAt: string | null;
  decisionNote: string | null;
  paypalOrderId: string | null;
  paymentStatus: string | null;
  approveUrl: string | null;
  paymentError: string | null;
  safety: SafetyResult;
  receipt: Receipt;
}

export interface RuleSettings {
  max_per_order: number;
  total_budget: number;
  spent_so_far: number;
  allowed_categories: string[];
  min_merchant_rating: number;
  require_return_policy: boolean;
  approval_limit: number;
}

export type RulesUpdate = Omit<RuleSettings, "spent_so_far">;

export interface Merchant {
  name: string;
  rating: number;
  has_return_policy: boolean;
}

export interface PurchaseInput {
  task: string;
  item: string;
  price: number;
  merchant: string;
  category: string;
  page_text: string;
  agent: string;
}

export interface PurchaseResult {
  decision: EngineDecision;
  reason: string;
  paypal_order_id: string | null;
  receipt: Receipt;
  transaction_id: string;
  payment_status: string | null;
  approve_url: string | null;
}

export interface RuleResult {
  rule: string;
  passed: boolean;
  reason: string;
}

export interface Evaluation {
  decision: EngineDecision;
  reason: string;
  safety: SafetyResult;
  rules: RuleResult[];
  needs_approval: boolean;
  receipt: Receipt;
}

export interface Stats {
  total_budget: number;
  spent_so_far: number;
  remaining_budget: number;
  approval_limit: number;
  max_per_order: number;
  counts: { approved: number; held: number; blocked: number };
  pending_approvals: number;
  blocked_amount: number;
  spending_by_day: { day: string; date: string; amount: number }[];
}

export interface Health {
  status: string;
  llm: string;
  paypal_mode: "mock" | "sandbox";
}
