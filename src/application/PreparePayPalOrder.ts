import { PaymentNotOpen } from "@/domain/errors";
import type { Order } from "@/domain/Order";
import { OrderStatus, SHOP_NAME } from "@/domain/types";
import { requireOrderByToken, type OrderDeps } from "./orderSupport";
import { PaymentGatewayError, type PaymentGateway, type PayPalOrderRequest } from "./ports/PaymentGateway";
import type { PayUrl } from "./ports/TokenFactory";

/** PayPal order statuses the buyer can still approve and pay. */
const STILL_PAYABLE = ["CREATED", "SAVED", "APPROVED", "PAYER_ACTION_REQUIRED"];

interface Deps extends Pick<OrderDeps, "orders" | "uow"> {
  gateway: PaymentGateway;
  payUrl: PayUrl;
}

/**
 * Called when the customer taps PayPal's button: reuse this order's PayPal order while it's still payable,
 * otherwise create one from the frozen order. Amounts always come from our order, never from the AI.
 */
export class PreparePayPalOrder {
  constructor(private readonly deps: Deps) {}

  async execute(payToken: string): Promise<{ paypalOrderId: string }> {
    const order = requireOrderByToken(this.deps.orders, payToken);
    assertPayable(order);
    const existing = order.payment?.paypalOrderId ?? null;
    const status = existing ? await this.statusOf(existing) : null;
    // PayPal already took money for this order: never start a second payment.
    if (status === PAYPAL_ORDER_COMPLETED) throw new PaymentNotOpen(CHECKING);
    if (existing && status && STILL_PAYABLE.includes(status)) return { paypalOrderId: existing };

    const attempt = (order.payment?.attempt ?? 0) + 1;
    const request = toPayPalRequest(order, this.deps.payUrl(payToken));
    const created = await this.deps.gateway.createOrder(request, `create-${order.id}-${attempt}`);
    this.deps.uow.run(() => {
      const fresh = requireOrderByToken(this.deps.orders, payToken);
      fresh.recordPayPalOrder(created.paypalOrderId, created.status);
      this.deps.orders.save(fresh);
    });
    return { paypalOrderId: created.paypalOrderId };
  }

  /** An expired or unknown PayPal order isn't an error (null): we simply make a new one. */
  private async statusOf(paypalOrderId: string): Promise<string | null> {
    try {
      return await this.deps.gateway.getOrderStatus(paypalOrderId);
    } catch (error) {
      if (error instanceof PaymentGatewayError && !error.retryable) return null;
      throw error;
    }
  }
}

/** PayPal's status for an order whose payment was captured (even one still clearing). */
const PAYPAL_ORDER_COMPLETED = "COMPLETED";
const CHECKING = "We've received a payment for this order and the shop is checking it. No need to pay again.";

export function assertPayable(order: Order): void {
  if (order.status === OrderStatus.Paid) throw new PaymentNotOpen("This order is already paid.");
  if (order.amountMismatch) throw new PaymentNotOpen(CHECKING);
  if (order.status === OrderStatus.Cancelled)
    throw new PaymentNotOpen("This order was cancelled by the shop.");
  if (order.status !== OrderStatus.AwaitingPayment)
    throw new PaymentNotOpen("This order isn't waiting for payment.");
}

/** The frozen order in PayPal's terms: items, delivery as shipping, and the total in US dollars. */
export function toPayPalRequest(order: Order, payUrl: string): PayPalOrderRequest {
  const items = order.items();
  const itemTotalCents = items.reduce((sum, item) => sum + item.lineTotal().cents, 0);
  return {
    referenceId: order.id,
    // PayPal refuses a repeated invoice ID, and Reset demo restarts numbering, so add part of the order's ID.
    invoiceId: `${order.number}-${order.id.slice(0, 8)}`,
    description: `${SHOP_NAME} order #${order.number}`,
    lines: items.map((item) => ({
      name: item.name(),
      quantity: item.quantity(),
      unitAmountCents: item.unitPrice().cents,
    })),
    itemTotalCents,
    shippingCents: order.deliveryFee().money?.cents ?? 0,
    totalCents: order.total().cents,
    brandName: SHOP_NAME,
    returnUrl: payUrl,
    cancelUrl: payUrl,
  };
}
