import { CheckCircle2, XCircle } from "lucide-react";
import type { Check } from "@/lib/types";

/** The safety + rule checks recorded on an AgentGuard decision receipt. */
export function ReceiptChecks({ checks }: { checks: Check[] }) {
  return (
    <div className="check-list">
      {checks.map((check) => (
        <div className="check-item" key={check.name}>
          {check.passed ? (
            <CheckCircle2 size={14} color="var(--green)" style={{ flexShrink: 0, marginTop: 1 }} aria-label="Passed" />
          ) : (
            <XCircle size={14} color="var(--red)" style={{ flexShrink: 0, marginTop: 1 }} aria-label="Failed" />
          )}
          <div>
            <strong>{check.name}</strong>
            <span>{check.detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
