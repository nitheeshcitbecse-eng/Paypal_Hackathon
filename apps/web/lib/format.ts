import type { Decision, EngineDecision } from "./types";

export function usd(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

export const decisionLabel: Record<EngineDecision, Decision> = {
  allowed: "Approved",
  held: "Held",
  blocked: "Blocked",
};

export const decisionTone: Record<Decision, "success" | "warning" | "danger"> = {
  Approved: "success",
  Held: "warning",
  Blocked: "danger",
};

export function paymentLabel(status: string | null | undefined): string {
  switch (status) {
    case null:
    case undefined:
      return "Not sent to PayPal";
    case "COMPLETED":
      return "Captured";
    case "AUTHORIZED":
      return "Reserved (authorized)";
    case "CREATED":
      return "Order created · awaiting payer";
    case "PAYER_ACTION_REQUIRED":
      return "Awaiting PayPal payer approval";
    case "VOIDED":
      return "Voided · not charged";
    case "VOID_FAILED":
      return "Void failed · check PayPal";
    case "FAILED":
      return "PayPal error · not charged";
    default:
      return status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " ");
  }
}

/** Payment states where the purchase is approved but money is not captured yet (Sandbox). */
export const AWAITING_CAPTURE = new Set(["CREATED", "APPROVED", "PAYER_ACTION_REQUIRED"]);
