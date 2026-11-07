import { Draft } from "@/domain/Draft";
import { OrderNotPayable } from "@/domain/errors";
import { requireOrder, saveWithEvents, type OrderDeps } from "./orderSupport";
import type { PayUrl, TokenFactory } from "./ports/TokenFactory";

interface Deps extends OrderDeps {
  tokens: TokenFactory;
  payUrl: PayUrl;
}

/**
 * Freezes the order's items and total, opens its one pay link, and drafts the payment message for the
 * seller to send. Pressing it twice gives the same link.
 */
export class RequestPayment {
  constructor(private readonly deps: Deps) {}

  execute(orderId: string): { payToken: string; payUrl: string } {
    const { orders, drafts, uow, ids, tokens, payUrl } = this.deps;
    return uow.run(() => {
      const order = requireOrder(orders, orderId);
      const event = order.requestPayment(tokens.newPayToken());
      const payToken = order.payToken;
      if (!payToken) throw new OrderNotPayable("This order has no pay link.");
      if (event) {
        saveWithEvents(this.deps, order, event);
        const total = order.total();
        const draft = Draft.paymentRequest(
          ids.newId(),
          order.conversationId,
          { id: order.id, number: order.number, total, payToken },
          payUrl(payToken),
        );
        drafts.save(draft);
      }
      return { payToken, payUrl: payUrl(payToken) };
    });
  }
}
