export type Decision = "Approved" | "Held" | "Blocked";

export interface Transaction {
  id: string;
  merchant: string;
  merchantInitials: string;
  product: string;
  agent: string;
  amount: number;
  currency: string;
  date: string;
  status: Decision;
  category: string;
  reason: string;
  receiptId: string;
}

export interface Approval extends Transaction {
  merchantRating?: string;
  reviews?: string;
  holdReason?: string;
}

export interface PurchaseRequest {
  agent: string;
  prompt: string;
}

export interface RuleSet {
  strict: boolean;
  merchantVerification: boolean;
  returnPolicy: boolean;
  dailyCap: number;
  transactionCap: number;
  humanApproval: number;
  allowedCategories: string[];
}

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api"
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiErrorNotification {
  kind: "technical" | "transaction";
  title: string;
  message: string;
  retry: () => Promise<unknown>;
  snoozedUntil?: number;
}

export type AppNotificationKind = "technical" | "payment" | "success" | "info";

export interface AppNotification {
  id: string;
  type: AppNotificationKind;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  entityId?: string;
}

export const API_ERROR_EVENT = "agentguard:api-error";
export const APP_NOTIFICATION_EVENT = "agentguard:notification";
const APP_NOTIFICATIONS_STORAGE_KEY = "agentguard:notifications";

declare global {
  interface Window {
    __agentGuardApiError?: ApiErrorNotification;
    __agentGuardLatestNotification?: AppNotification;
  }
}

const EMPTY_APP_NOTIFICATIONS: AppNotification[] = [];
let appNotifications: AppNotification[] = EMPTY_APP_NOTIFICATIONS;
const appNotificationStoreListeners = new Set<() => void>();

function isAppNotification(item: unknown): item is AppNotification {
  if (!item || typeof item !== "object") return false;
  const notification = item as Partial<AppNotification>;
  return typeof notification.id === "string" &&
    (notification.type === "technical" ||
      notification.type === "payment" ||
      notification.type === "success" ||
      notification.type === "info") &&
    typeof notification.title === "string" &&
    typeof notification.message === "string" &&
    typeof notification.createdAt === "string" &&
    typeof notification.read === "boolean";
}

function updateAppNotifications(notifications: AppNotification[]) {
  appNotifications = notifications.slice(0, 50);
  appNotificationStoreListeners.forEach((listener) => listener());
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(
        APP_NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(appNotifications),
      );
    } catch {
      // The in-memory notification list remains available without session storage.
    }
  }
}

export function getAppNotificationsSnapshot() {
  return appNotifications;
}

export function getServerAppNotificationsSnapshot(): AppNotification[] {
  return EMPTY_APP_NOTIFICATIONS;
}

export function subscribeToAppNotificationStore(listener: () => void) {
  appNotificationStoreListeners.add(listener);
  return () => {
    appNotificationStoreListeners.delete(listener);
  };
}

export function hydrateAppNotifications(storedNotifications: AppNotification[]) {
  const merged = [...appNotifications];
  for (const notification of storedNotifications) {
    if (!merged.some((item) => item.id === notification.id)) merged.push(notification);
  }
  if (
    typeof window !== "undefined" &&
    window.__agentGuardLatestNotification &&
    !merged.some((item) => item.id === window.__agentGuardLatestNotification?.id)
  ) {
    merged.unshift(window.__agentGuardLatestNotification);
  }
  updateAppNotifications(merged);
}

export function markAppNotificationRead(id: string) {
  updateAppNotifications(
    appNotifications.map((notification) =>
      notification.id === id ? { ...notification, read: true } : notification,
    ),
  );
}

export function subscribeToApiErrors(listener: (error: ApiErrorNotification) => void) {
  function handleApiError(event: Event) {
    listener((event as CustomEvent<ApiErrorNotification>).detail);
  }

  window.addEventListener(API_ERROR_EVENT, handleApiError);
  if (window.__agentGuardApiError) listener(window.__agentGuardApiError);
  return () => {
    window.removeEventListener(API_ERROR_EVENT, handleApiError);
  };
}

export function clearApiError() {
  delete window.__agentGuardApiError;
}

export function publishAppNotification(
  notification: Omit<AppNotification, "id" | "createdAt" | "read">,
) {
  if (typeof window === "undefined") return;
  const recentNotifications = [...appNotifications];
  if (notification.type === "technical") {
    try {
      const stored: unknown = JSON.parse(
        window.sessionStorage.getItem(APP_NOTIFICATIONS_STORAGE_KEY) ?? "[]",
      );
      if (Array.isArray(stored)) {
        recentNotifications.push(...stored.filter(isAppNotification));
      }
    } catch {
      // The in-memory history is sufficient when session storage is unavailable.
    }

    const now = Date.now();
    const repeated = recentNotifications.some(
      (item) =>
        item.type === "technical" &&
        item.title === notification.title &&
        item.message === notification.message &&
        now - Date.parse(item.createdAt) < 10 * 60 * 1000,
    );
    if (repeated) return;
  }

  const next: AppNotification = {
    ...notification,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
  window.__agentGuardLatestNotification = next;
  updateAppNotifications([next, ...appNotifications]);
  window.dispatchEvent(new CustomEvent<AppNotification>(APP_NOTIFICATION_EVENT, { detail: next }));
}

export function subscribeToAppNotifications(listener: (notification: AppNotification) => void) {
  function handleNotification(event: Event) {
    listener((event as CustomEvent<AppNotification>).detail);
  }

  window.addEventListener(APP_NOTIFICATION_EVENT, handleNotification);
  if (window.__agentGuardLatestNotification) listener(window.__agentGuardLatestNotification);
  return () => {
    window.removeEventListener(APP_NOTIFICATION_EVENT, handleNotification);
  };
}

function notifyApiError(
  message: string,
  retry: () => Promise<unknown>,
  path: string,
  status: number,
) {
  if (typeof window === "undefined") return;
  const { kind, message: userMessage } = getFriendlyError(path, status, message);
  const notification: ApiErrorNotification = {
    kind,
    title: getErrorTitle(kind, path, message),
    message: userMessage,
    retry,
  };
  window.__agentGuardApiError = notification;
  window.dispatchEvent(new CustomEvent<ApiErrorNotification>(API_ERROR_EVENT, { detail: notification }));
  publishAppNotification({
    type: kind === "transaction" ? "payment" : "technical",
    title: notification.title,
    message: notification.message,
  });
}

function getErrorTitle(kind: "technical" | "transaction", path: string, message: string) {
  if (kind === "technical") return "A temporary technical issue";
  if (/\/rules(?:\/|$)/i.test(path)) return "Couldn't save your rules";
  if (/(?:budget|spending rule|policy|limit)/i.test(message)) return "Purchase declined by your rules";
  return "Payment needs your attention";
}

function getFriendlyError(path: string, status: number, message: string) {
  const kind = isInfrastructureError(message) || status === 0 || status >= 500
    ? isBusinessError(message) ? "transaction" : "technical"
    : isBusinessError(message)
      ? "transaction"
      : status >= 400 && status < 500
        ? "transaction"
        : "technical";
  if (kind === "technical") {
    return {
      kind,
      message: "A temporary technical issue occurred. Our development team has been notified and is inspecting the system.",
    } as const;
  }
  if (/\/approvals\/[^/]+\/action(?:\/|$)/i.test(path)) {
    return { kind, message: "We couldn't complete that approval action. Please try again." } as const;
  }
  if (/\/rules(?:\/|$)/i.test(path)) {
    return { kind, message: "We couldn't save your guardrails. Please review your changes and try again." } as const;
  }
  if (/(?:budget|spending rule|policy|limit)/i.test(message)) {
    return { kind, message: "This purchase was declined by your spending rules." } as const;
  }
  return {
    kind,
    message: "Your payment could not be completed. Please review your payment details or try again.",
  } as const;
}

function isBusinessError(message: string) {
  return /(?:paypal.{0,30}(?:authorization|payment|checkout|declin)|(?:authorization|payment|checkout|declin).{0,30}paypal|payment (?:authorization|authori[sz]ation|failed|declined)|authorization failed|authori[sz]ation failed|checkout failed|business[\s-]*logic|purchase rejected|transaction declined|card declined|insufficient funds|budget (?:exceeded|limit|rejected)|spending rule|policy (?:rejection|violation)|rule violation)/i.test(
    message,
  );
}

function isInfrastructureError(message: string) {
  return /(?:database|db connection|connection refused|timed?\s*out|timeout|internal server|server error|network|unavailable|failed to reach|query failed|service down)/i.test(
    message,
  );
}

function getResponseError(body: string, status: number): string {
  if (body.trim()) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed && typeof parsed === "object") {
        const error = parsed as { error?: unknown; message?: unknown };
        if (typeof error.message === "string" && error.message.trim()) return error.message;
        if (typeof error.error === "string" && error.error.trim()) return error.error;
      }
    } catch {
      return body.trim();
    }
    return body.trim();
  }
  return `Express API request failed (${status}).`;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  showErrorDialog = true,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const request = () =>
    apiRequest<T>(path, init, false);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    const message = "A temporary technical issue occurred.";
    if (showErrorDialog) notifyApiError(message, request, path, 0);
    throw new ApiError(message, 0);
  }

  if (!response.ok) {
    let responseBody: string;
    try {
      responseBody = await response.text();
    } catch (error) {
      if (init?.signal?.aborted) throw error;
      const message = "A temporary technical issue occurred.";
      if (showErrorDialog) notifyApiError(message, request, path, response.status);
      throw new ApiError(message, response.status);
    }

    const message = getResponseError(responseBody, response.status);
    if (showErrorDialog) notifyApiError(message, request, path, response.status);
    throw new ApiError(getFriendlyError(path, response.status, message).message, response.status);
  }

  if (response.status === 204) return undefined as T;

  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    const message = "A temporary technical issue occurred.";
    if (showErrorDialog) notifyApiError(message, request, path, response.status);
    throw new ApiError(message, response.status);
  }
  if (!body.trim()) return undefined as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    const message = "A temporary technical issue occurred.";
    if (showErrorDialog) notifyApiError(message, request, path, response.status);
    throw new ApiError(message, response.status);
  }
}

export function createPurchaseRequest(request: PurchaseRequest) {
  return apiRequest<Transaction>("/purchase-request", {
    method: "POST",
    body: JSON.stringify(request),
  }).then((transaction) => {
    if (transaction?.status === "Approved") {
      publishAppNotification({
        type: "success",
        title: "Purchase approved",
        message: `${transaction.merchant || "Your purchase"} was approved successfully.`,
        entityId: transaction.id,
      });
    } else if (transaction?.status === "Blocked") {
      publishAppNotification({
        type: "payment",
        title: "Purchase declined",
        message: "This purchase was declined by your spending rules.",
        entityId: transaction.id,
      });
    } else if (transaction?.status === "Held") {
      publishAppNotification({
        type: "info",
        title: "Approval required",
        message: "Your purchase request is waiting for review.",
        entityId: transaction.id,
      });
    }
    return transaction;
  });
}

export async function getApprovals(): Promise<Approval[]> {
  const data = await apiRequest<Approval[] | null>("/approvals");
  return Array.isArray(data) ? data : [];
}

export function submitApprovalAction(id: string, action: "approve" | "reject") {
  return apiRequest<void>(`/approvals/${encodeURIComponent(id)}/action`, {
    method: "POST",
    body: JSON.stringify({ action }),
  }).then((result) => {
    publishAppNotification({
      type: action === "approve" ? "success" : "info",
      title: action === "approve" ? "Purchase approved" : "Purchase declined",
      message: action === "approve"
        ? "The approval was completed successfully."
        : "The purchase request was declined.",
      entityId: id,
    });
    return result;
  });
}

export async function getOrders(): Promise<Transaction[]> {
  const data = await apiRequest<Transaction[] | null>("/orders");
  return Array.isArray(data) ? data : [];
}

export function getOrder(id: string): Promise<Transaction | null> {
  return apiRequest<Transaction | null>(`/orders/${encodeURIComponent(id)}`);
}

export function getRules(): Promise<RuleSet | null> {
  return apiRequest<RuleSet | null>("/rules");
}

export function saveRules(rules: RuleSet): Promise<RuleSet | null> {
  return apiRequest<RuleSet | null>("/rules", {
    method: "PUT",
    body: JSON.stringify(rules),
  });
}
