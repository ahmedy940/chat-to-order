import type { Order } from "./Order";
import { Intent, OrderStatus, ProposalKind } from "./types";

export interface AgentProposalDraft {
  kind: ProposalKind;
  reason: string;
  quote: string | null;
}

export interface PolicyInput {
  /** What the AI says the customer wants, or null when the AI is unavailable. */
  intent: Intent | null;
  quote: string | null;
  order: Order | null;
}

/**
 * Turns what the customer wants plus the order's status into at most one proposal for the seller.
 * The AI only says what the customer wants; this rule decides what may be proposed, and amounts
 * always come from the order itself.
 */
export class NextActionPolicy {
  propose({ intent, quote, order }: PolicyInput): AgentProposalDraft | null {
    if (intent === null || order === null) return null;
    if (order.isEditable()) return this.forEditable(order);
    if (order.status === OrderStatus.AwaitingPayment) {
      return intent === Intent.RefundRequest ? null : this.remind(order, quote);
    }
    if (order.status === OrderStatus.Paid && intent === Intent.RefundRequest)
      return this.refund(order, quote);
    return null;
  }

  private forEditable(order: Order): AgentProposalDraft | null {
    if (order.canRequestPayment()) {
      const reason = `Nothing is missing on #${order.number}. Total ${order.total().format()}.`;
      return { kind: ProposalKind.RequestPayment, reason, quote: null };
    }
    const names = [...new Set(order.askableDetails().map((detail) => detail.label.toLowerCase()))];
    if (names.length === 0) return null;
    return { kind: ProposalKind.Ask, reason: `Still missing: ${names.join(", ")}.`, quote: null };
  }

  private remind(order: Order, quote: string | null): AgentProposalDraft {
    const reason = `#${order.number} is still unpaid and the customer wrote.`;
    return { kind: ProposalKind.Remind, reason, quote };
  }

  private refund(order: Order, quote: string | null): AgentProposalDraft {
    const reason = `The customer asked to return paid order #${order.number}.`;
    return { kind: ProposalKind.Refund, reason, quote };
  }
}
