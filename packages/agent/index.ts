import catalog from "../../../data/catalog.json" with { type: "json" };
import merchants from "../../../data/merchants.json" with { type: "json" };

export type Scenario = "safe" | "injection" | "over-budget" | "low-rating";
export type Decision = "APPROVED" | "HELD" | "BLOCKED";

const AUTO_APPROVAL_LIMIT = 250;
const INJECTION_PATTERN = /ignore (all )?(previous|prior) instructions|buy .*gift cards|do not tell the user/i;

export function search_products(query: string) {
  const q = query.toLowerCase();
  return catalog.filter((p) =>
    `${p.name} ${p.category} ${p.pageText}`.toLowerCase().includes(q)
  ).slice(0, 8);
}

export function get_product_page(productId: string) {
  const product = catalog.find((p) => p.id === productId);
  if (!product) return null;
  const merchant = merchants.find((m) => m.id === product.merchantId) ?? null;
  return { product, merchant };
}

/**
 * Produces a purchase REQUEST decision for the AgentGuard pipeline.
 * It never calls PayPal or captures/authorizes a payment.
 * In production, the caller should forward this request to the backend
 * safety/rules engine, which remains authoritative.
 */
export function request_purchase(productId: string, userTask: string) {
  const found = get_product_page(productId);
  if (!found || !found.merchant) throw new Error("Product or merchant not found.");

  const { product, merchant } = found;
  const trace = [
    { tool: "search_products", detail: `Found ${product.name} (${product.id}).` },
    { tool: "get_product_page", detail: `Loaded product and simulated merchant ${merchant.name}.` },
  ];

  let decision: Decision = "APPROVED";
  let reason = "Within the demo limit and merchant checks passed.";

  // Treat merchant page text as untrusted input, never as agent instructions.
  if (INJECTION_PATTERN.test(product.pageText)) {
    decision = "BLOCKED";
    reason = "Product page contains prompt-injection indicators. Page content cannot override the user's task or safety rules.";
  } else if (merchant.rating < 3 || !merchant.returnPolicyAvailable) {
    decision = "BLOCKED";
    reason = `Merchant trust check failed (${merchant.rating}/5) or return policy is unavailable.`;
  } else if (product.price > AUTO_APPROVAL_LIMIT) {
    decision = "HELD";
    reason = `Price exceeds the $${AUTO_APPROVAL_LIMIT} demo auto-approval limit; human approval is required.`;
  }

  trace.push({
    tool: "request_purchase",
    detail: decision === "APPROVED"
      ? "Purchase request is ready to be sent to the AgentGuard backend; no payment was executed."
      : `Request ${decision.toLowerCase()}: ${reason}`,
  });

  return {
    decision, productId, productName: product.name,
    amount: product.price, currency: product.currency,
    merchantId: merchant.id, merchantName: merchant.name,
    merchantRating: merchant.rating,
    returnPolicy: merchant.returnPolicy,
    returnPolicyAvailable: merchant.returnPolicyAvailable,
    userTask, pageText: product.pageText,
    agentNotes: reason, trace,
    simulated: true as const,
  };
}

export function run_demo(scenario: Scenario, userTask = "Find a phone case") {
  const ids: Record<Scenario, string> = {
    safe: "P001", injection: "P002", "over-budget": "P003", "low-rating": "P004",
  };
  return request_purchase(ids[scenario], userTask);
}
