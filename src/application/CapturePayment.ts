import { Draft } from "@/domain/Draft";
import { PaymentNotOpen } from "@/domain/errors";
import { OrderStatus } from "@/domain/types";
import { requireOrderByToken, saveWithEvents, type OrderDeps } from "./orderSupport";
import type { PaymentGateway } from "./ports/PaymentGateway";
import { assertPayable } from "./PreparePayPalOrder";

export type CaptureOutcome = "paid" | "already_paid" | "mismatch";

/**
 * After the customer approves on PayPal: capture the money, check it matches the frozen total, and only then
 * mark the order Paid. Capturing twice marks it Paid once. A thank-you is drafted for the seller.
 */
export class CapturePayment {
  constructor(private readonly deps: OrderDeps & { gateway: PaymentGateway }) {}

  async execute(payToken: string, paypalOrderId: string): Promise<{ outcome: CaptureOutcome }> {
    const order = requireOrderByToken(this.deps.orders, payToken);
    if (order.status === OrderStatus.Paid) return { outcome: "already_paid" };
    assertPayable(order);
    if (order.payment?.paypalOrderId !== paypalOrderId) {
      throw new PaymentNotOpen("This PayPal payment doesn't belong to this order.");
    }
    const capture = await this.deps.gateway.capture(paypalOrderId, `capture-${order.id}-${paypalOrderId}`);
    return this.deps.uow.run(() => {
      const fresh = requireOrderByToken(this.deps.orders, payToken);
      const event = fresh.markPaid(capture);
      saveWithEvents(this.deps, fresh, event);
      if (fresh.status !== OrderStatus.Paid) return { outcome: "mismatch" as const };
      if (!event) return { outcome: "already_paid" as const };
      const draft = Draft.thanks(this.deps.ids.newId(), fresh.conversationId, fresh, capture.payer.name);
      this.deps.drafts.save(draft);
      return { outcome: "paid" as const };
    });
  }
}
