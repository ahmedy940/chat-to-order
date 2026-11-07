import type { Money } from "./Money";
import { DraftKind } from "./types";

export interface DraftSnapshot {
  id: string;
  conversationId: string;
  kind: DraftKind;
  text: string;
  /** Tap buttons sent with the message (the options the seller offered). */
  options: string[];
  orderId: string | null;
  payToken: string | null;
  /** Written by the AI: shown in AI blue. Fixed-text drafts are gray. */
  byAi: boolean;
}

interface OrderRef {
  id: string;
  number: number;
}

/**
 * The one prepared message waiting in the seller's reply box. Nothing is sent until the seller presses Send.
 * The AI writes questions and the payment message's opening line; our code always inserts the order number,
 * total and link. Thank-you and refund messages are fixed text.
 */
export class Draft {
  private constructor(private readonly data: DraftSnapshot) {}

  /** Asks the customer only for what's still missing, with the offered options as tap buttons. */
  static question(q: Omit<DraftSnapshot, "kind" | "payToken">): Draft {
    return new Draft({ ...q, kind: DraftKind.Question, options: [...q.options], payToken: null });
  }

  /** `lead` is the AI's friendly opening line; without it, a fixed sentence. */
  static paymentRequest(p: {
    id: string;
    conversationId: string;
    order: OrderRef & { total: Money; payToken: string };
    payUrl: string;
    lead: string | null;
  }): Draft {
    const { order, payUrl, lead } = p;
    const total = order.total.format();
    const text = lead
      ? `${lead}\n\nOrder #${order.number} · total ${total}\nPay securely here: ${payUrl}`
      : `Here's your order #${order.number}, total ${total}. Pay securely here: ${payUrl}`;
    const ids = { id: p.id, conversationId: p.conversationId, orderId: order.id, payToken: order.payToken };
    return new Draft({ ...ids, kind: DraftKind.Payment, text, options: [], byAi: lead !== null });
  }

  /** A gentle nudge to pay, with the same pay link (sent as a pay-link card). Fixed text. */
  static reminder(
    id: string,
    conversationId: string,
    order: OrderRef & { total: Money; payToken: string },
    payUrl: string,
  ): Draft {
    const text = `Just a friendly reminder: order #${order.number} (${order.total.format()}) is ready whenever you are. Pay securely here: ${payUrl}`;
    const ids = { id, conversationId, orderId: order.id, payToken: order.payToken };
    return new Draft({ ...ids, kind: DraftKind.Payment, text, options: [], byAi: false });
  }

  static thanks(id: string, conversationId: string, order: OrderRef, payerName: string | null): Draft {
    const firstName = payerName?.split(" ")[0];
    const greeting = firstName ? `Thank you, ${firstName}!` : "Thank you!";
    const text = `${greeting} We've received your payment for order #${order.number}. We'll let you know when it ships.`;
    return Draft.fixed({ id, conversationId, kind: DraftKind.Thanks, text, orderId: order.id });
  }

  static refund(id: string, conversationId: string, order: OrderRef & { refunded: Money }): Draft {
    const text = `We've refunded ${order.refunded.format()} to your PayPal account for order #${order.number}. It can take a few days to show.`;
    return Draft.fixed({ id, conversationId, kind: DraftKind.Refund, text, orderId: order.id });
  }

  static restore(snapshot: DraftSnapshot): Draft {
    return new Draft({ ...snapshot, options: [...snapshot.options] });
  }

  private static fixed(f: Pick<DraftSnapshot, "id" | "conversationId" | "kind" | "text" | "orderId">): Draft {
    return new Draft({ ...f, options: [], payToken: null, byAi: false });
  }

  get id(): string {
    return this.data.id;
  }

  get orderId(): string | null {
    return this.data.orderId;
  }

  get kind(): DraftKind {
    return this.data.kind;
  }

  get text(): string {
    return this.data.text;
  }

  get options(): readonly string[] {
    return this.data.options;
  }

  get payToken(): string | null {
    return this.data.payToken;
  }

  get byAi(): boolean {
    return this.data.byAi;
  }

  snapshot(): DraftSnapshot {
    return { ...this.data, options: [...this.data.options] };
  }
}
