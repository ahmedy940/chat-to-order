import { Actor } from "@/domain/types";
import { requireOrder, saveWithEvents, type OrderDeps } from "./orderSupport";

/**
 * Cancels an order before it's paid. Its pay link then shows "cancelled" and can't take payment, and an
 * unsent payment message for it is removed from the reply box.
 */
export class CancelOrder {
  constructor(private readonly deps: OrderDeps) {}

  execute(orderId: string, actor: Actor = Actor.Seller): { orderId: string } {
    const { orders, drafts, uow } = this.deps;
    return uow.run(() => {
      const order = requireOrder(orders, orderId);
      const event = order.cancel(actor);
      saveWithEvents(this.deps, order, event);
      if (event && drafts.get(order.conversationId)?.orderId === order.id) drafts.clear(order.conversationId);
      return { orderId: order.id };
    });
  }
}
