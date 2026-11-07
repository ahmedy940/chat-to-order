import { Draft } from "@/domain/Draft";
import { RefundNotAllowed } from "@/domain/errors";
import { Money } from "@/domain/Money";
import type { Order } from "@/domain/Order";
import { Actor, OrderStatus } from "@/domain/types";
import { requireOrder, saveWithEvents, type OrderDeps } from "./orderSupport";
import { PaymentGatewayError, type PaymentGateway } from "./ports/PaymentGateway";

export type RefundOutcome = "refunded" | "already_refunded";

/**
 * Refunds a paid order in full through PayPal, from the order card: no searching in PayPal. The request ID
 * `refund-{orderId}` means pressing it twice refunds once. If PayPal refuses, the order stays Paid and the
 * timeline says why.
 */
export class RefundPayment {
  constructor(private readonly deps: OrderDeps & { gateway: PaymentGateway }) {}

  async execute(orderId: string, actor: Actor = Actor.Seller): Promise<{ outcome: RefundOutcome }> {
    const order = requireOrder(this.deps.orders, orderId);
    if (order.status === OrderStatus.Refunded) return { outcome: "already_refunded" };
    order.assertRefundable();
    const refund = await this.refundAtPayPal(order);
    return this.deps.uow.run(() => {
      const fresh = requireOrder(this.deps.orders, orderId);
      const event = fresh.markRefunded(refund, actor);
      saveWithEvents(this.deps, fresh, event);
      if (!event) return { outcome: "already_refunded" as const };
      const refunded = Money.ofCents(refund.amountCents);
      const ref = { id: fresh.id, number: fresh.number, refunded };
      this.deps.drafts.save(Draft.refund(this.deps.ids.newId(), fresh.conversationId, ref));
      return { outcome: "refunded" as const };
    });
  }

  private async refundAtPayPal(order: Order) {
    const captureId = order.payment?.captureId;
    if (!captureId) throw new RefundNotAllowed(order.status);
    try {
      return await this.deps.gateway.refund(captureId, `refund-${order.id}`);
    } catch (error) {
      // PayPal said no (not just unreachable): log it on the timeline. The order stays Paid either way.
      if (error instanceof PaymentGatewayError && !error.retryable)
        this.recordRefusal(order.id, error.message);
      throw error;
    }
  }

  private recordRefusal(orderId: string, reason: string): void {
    this.deps.uow.run(() => {
      const fresh = requireOrder(this.deps.orders, orderId);
      saveWithEvents(this.deps, fresh, fresh.refundFailed(reason));
    });
  }
}
