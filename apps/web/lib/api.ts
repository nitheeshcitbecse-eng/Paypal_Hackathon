import type {
  Evaluation,
  Health,
  Merchant,
  PurchaseInput,
  PurchaseResult,
  RuleSettings,
  RulesUpdate,
  Stats,
  Transaction,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:5000/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly transactionId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ValidationIssue = { loc?: (string | number)[]; msg?: string };

/** Turns FastAPI error bodies ({"detail": "..."} or validation lists) into readable text. */
function errorMessage(text: string, status: number): { message: string; transactionId?: string } {
  try {
    const body = JSON.parse(text) as { detail?: string | ValidationIssue[]; transaction_id?: string };
    if (typeof body.detail === "string") {
      return { message: body.detail, transactionId: body.transaction_id };
    }
    if (Array.isArray(body.detail)) {
      const issues = body.detail.map((issue) => {
        const field = (issue.loc ?? []).filter((part) => part !== "body").join(".");
        return field ? `${field}: ${issue.msg}` : issue.msg;
      });
      return { message: issues.join("; ") };
    }
  } catch {
    // not JSON
  }
  return { message: text || `AgentGuard API request failed (${status}).` };
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T | undefined> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      `Cannot reach the AgentGuard API at ${API_BASE_URL}. Make sure the backend is running.`,
      0,
    );
  }

  if (!response.ok) {
    const { message, transactionId } = errorMessage(await response.text(), response.status);
    throw new ApiError(message, response.status, transactionId);
  }

  if (response.status === 204) {
    return undefined;
  }

  return (await response.json()) as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiRequest<T>(path, init)) as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

const enc = encodeURIComponent;

export const api = {
  health: () => request<Health>("/health"),
  stats: () => request<Stats>("/stats"),

  purchase: (input: PurchaseInput) => post<PurchaseResult>("/purchase", input),
  evaluate: (input: PurchaseInput) => post<Evaluation>("/evaluate", input),

  rules: () => request<RuleSettings>("/rules"),
  updateRules: (rules: RulesUpdate) =>
    request<RuleSettings>("/rules", { method: "PUT", body: JSON.stringify(rules) }),
  resetSpend: () => post<RuleSettings>("/rules/reset-spend"),

  merchants: () => request<Merchant[]>("/merchants"),
  upsertMerchant: (merchant: Merchant) =>
    request<Merchant>(`/merchants/${enc(merchant.name)}`, {
      method: "PUT",
      body: JSON.stringify({ rating: merchant.rating, has_return_policy: merchant.has_return_policy }),
    }),
  deleteMerchant: (name: string) => request<void>(`/merchants/${enc(name)}`, { method: "DELETE" }),

  transactions: (params: { status?: string; q?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.q) query.set("q", params.q);
    query.set("limit", String(params.limit ?? 500));
    return request<Transaction[]>(`/transactions?${query}`);
  },
  transaction: (id: string) => request<Transaction>(`/transactions/${enc(id)}`),
  capture: (id: string) => post<Transaction>(`/transactions/${enc(id)}/capture`),

  approvals: () => request<Transaction[]>("/approvals"),
  approve: (id: string, note?: string) => post<Transaction>(`/approvals/${enc(id)}/approve`, { note: note || null }),
  reject: (id: string, note?: string) => post<Transaction>(`/approvals/${enc(id)}/reject`, { note: note || null }),
};

/** Re-reads the approval queue size and tells the sidebar badge about it. */
export async function refreshApprovalCount(): Promise<void> {
  try {
    const queue = await api.approvals();
    window.dispatchEvent(new CustomEvent<number>("agentguard:approval-count", { detail: queue.length }));
  } catch {
    // badge is best-effort
  }
}
