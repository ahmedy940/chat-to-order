import { ConversationNotFound } from "@/domain/errors";
import { Order } from "@/domain/Order";
import { FINISHED_ORDER_STATUSES } from "@/domain/types";
import type { OrderDeps } from "./orderSupport";
import type { ConversationRepository } from "./ports/ConversationRepository";

/** The seller starts an order card by hand (the same path used whenever the AI can't read a chat). */
export class StartOrder {
  constructor(private readonly deps: OrderDeps & { conversations: ConversationRepository }) {}

  execute(conversationId: string): { orderId: string } {
    const { orders, conversations, uow, ids } = this.deps;
    return uow.run(() => {
      if (!conversations.get(conversationId)) throw new ConversationNotFound();
      const current = orders.latestForConversation(conversationId);
      if (current && !FINISHED_ORDER_STATUSES.includes(current.status)) return { orderId: current.id };
      const order = Order.open(ids.newId(), orders.nextNumber(), conversationId);
      order.addBlankItem(ids.newId());
      orders.save(order);
      return { orderId: order.id };
    });
  }
}
