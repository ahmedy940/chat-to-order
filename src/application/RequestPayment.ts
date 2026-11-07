import { Draft } from "@/domain/Draft";
import { OrderNotPayable } from "@/domain/errors";
import type { Order } from "@/domain/Order";
import { requireOrder, saveWithEvents, type OrderDeps } from "./orderSupport";
import type { AiProvider } from "./ports/AiProvider";
import type { ConversationRepository } from "./ports/ConversationRepository";
import type { PayUrl, TokenFactory } from "./ports/TokenFactory";

interface Deps extends OrderDeps {
  conversations: ConversationRepository;
  tokens: TokenFactory;
  payUrl: PayUrl;
  ai: AiProvider;
}

/**
 * Freezes the order's items and total, opens its one pay link, and drafts the payment message for the
 * seller to send. The AI writes only a friendly opening line; our code adds the order number, total and link.
 * Pressing it twice gives the same link.
 */
export class RequestPayment {
  constructor(private readonly deps: Deps) {}

  async execute(orderId: string): Promise<{ payToken: string; payUrl: string }> {
    const lead = await this.leadIn(requireOrder(this.deps.orders, orderId));
    const { orders, drafts, uow, ids, tokens, payUrl } = this.deps;
    return uow.run(() => {
      const order = requireOrder(orders, orderId);
      const event = order.requestPayment(tokens.newPayToken());
      const payToken = order.payToken;
      if (!payToken) throw new OrderNotPayable("This order has no pay link.");
      if (event) {
        saveWithEvents(this.deps, order, event);
        const ref = { id: order.id, number: order.number, total: order.total(), payToken };
        const conversationId = order.conversationId;
        drafts.save(
          Draft.paymentRequest({
            id: ids.newId(),
            conversationId,
            order: ref,
            payUrl: payUrl(payToken),
            lead,
          }),
        );
      }
      return { payToken, payUrl: payUrl(payToken) };
    });
  }

  /** Only for a payment that will actually be requested now. If the AI is down, the fixed sentence is used. */
  private async leadIn(order: Order): Promise<string | null> {
    if (!order.canRequestPayment()) return null;
    const customerName = this.deps.conversations.get(order.conversationId)?.customerName ?? "there";
    const items = order
      .items()
      .map((item) => item.summary())
      .join(", ");
    try {
      return (await this.deps.ai.writePaymentLeadIn({ customerName, items })).trim() || null;
    } catch {
      return null;
    }
  }
}
