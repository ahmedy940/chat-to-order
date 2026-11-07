import type { Money } from "./Money";
import { DraftKind } from "./types";

export interface DraftSnapshot {
  id: string;
  conversationId: string;
  kind: DraftKind;
  text: string;
  options: string[];
  orderId: string | null;
  payToken: string | null;
}

interface OrderRef {
  id: string;
  number: number;
}

/**
 * The one prepared message waiting in the seller's reply box. Nothing is sent until the seller presses Send.
 * Payment and thank-you messages use fixed text for now; the AI writes questions from step 5.
 */
export class Draft {
  private constructor(private readonly data: DraftSnapshot) {}

  static paymentRequest(
    id: string,
    conversationId: string,
    order: OrderRef & { total: Money; payToken: string },
    payUrl: string,
  ): Draft {
    const text = `Here's your order #${order.number}, total ${order.total.format()}. Pay securely here: ${payUrl}`;
    const kind = DraftKind.Payment;
    return new Draft({
      id,
      conversationId,
      kind,
      text,
      options: [],
      orderId: order.id,
      payToken: order.payToken,
    });
  }

  static thanks(id: string, conversationId: string, order: OrderRef, payerName: string | null): Draft {
    const firstName = payerName?.split(" ")[0];
    const greeting = firstName ? `Thank you, ${firstName}!` : "Thank you!";
    const text = `${greeting} We've received your payment for order #${order.number}. We'll let you know when it ships.`;
    const kind = DraftKind.Thanks;
    return new Draft({ id, conversationId, kind, text, options: [], orderId: order.id, payToken: null });
  }

  static restore(snapshot: DraftSnapshot): Draft {
    return new Draft({ ...snapshot, options: [...snapshot.options] });
  }

  get id(): string {
    return this.data.id;
  }

  get kind(): DraftKind {
    return this.data.kind;
  }

  get text(): string {
    return this.data.text;
  }

  get payToken(): string | null {
    return this.data.payToken;
  }

  snapshot(): DraftSnapshot {
    return { ...this.data, options: [...this.data.options] };
  }
}
