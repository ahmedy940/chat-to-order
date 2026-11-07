import { Order } from "@/domain/Order";
import type { CaptureResult } from "@/domain/Payment";
import { ItemField, OrderField } from "@/domain/types";

export const ITEM_ID = "item-1";
export const FEE = { itemId: null, field: OrderField.DeliveryFee } as const;
export const at = (field: ItemField) => ({ itemId: ITEM_ID, field });

/** A draft order with one blank item: product, quantity and price all missing. */
export function blankOrder(): Order {
  const order = Order.open("order-1", 1001, "conv-1");
  order.addBlankItem(ITEM_ID);
  return order;
}

/** 2 × Beige linen dress (M) at $60, delivery $8: total $128, nothing missing. */
export function completeOrder(): Order {
  const order = blankOrder();
  order.settle(at(ItemField.Product), "Beige linen dress");
  order.settle(at(ItemField.Size), "M");
  order.settle(at(ItemField.Quantity), "2");
  order.settle(at(ItemField.UnitPrice), "$60");
  order.settle(FEE, "8");
  return order;
}

export function awaitingPaymentOrder(): Order {
  const order = completeOrder();
  order.requestPayment("token-abc");
  return order;
}

export function capture(overrides: Partial<CaptureResult> = {}): CaptureResult {
  return {
    paypalOrderId: "PP-ORDER-1",
    captureId: "CAPTURE-1",
    status: "COMPLETED",
    amountCents: 12800,
    currency: "USD",
    payer: { name: "Sarah Lee", email: "sarah@example.com", shipName: "Sarah Lee", shipAddress: null },
    feeCents: 410,
    netCents: 12390,
    ...overrides,
  };
}

export function paidOrder(): Order {
  const order = awaitingPaymentOrder();
  order.markPaid(capture());
  return order;
}
