import { ItemField, OrderField } from "@/domain/types";
import type { appWorld } from "./world";

/** Ready-made situations for the payment and refund tests. */

export type World = ReturnType<typeof appWorld>;

/** A customer chat with an order card started by hand. */
export function startedOrder(w: World) {
  const { conversationId } = w.receive.execute({ conversationId: null, clientId: "client-0001", text: "hi" });
  const { orderId } = w.startOrder.execute(conversationId);
  const itemId = w.orders.get(orderId)?.items()[0]?.id ?? "";
  return { conversationId, orderId, itemId };
}

/** The same order filled in by hand: 2 × $60 linen dress (M) + $8 delivery = $128. */
export function filledOrder(w: World) {
  const ids = startedOrder(w);
  const set = (field: ItemField, value: string) =>
    w.settle.execute({ orderId: ids.orderId, itemId: ids.itemId, field, value });
  set(ItemField.Product, "Beige linen dress");
  set(ItemField.Size, "M");
  set(ItemField.Quantity, "2");
  set(ItemField.UnitPrice, "60");
  w.settle.execute({ orderId: ids.orderId, itemId: null, field: OrderField.DeliveryFee, value: "8" });
  return ids;
}

/** Requested, PayPal order prepared and captured. */
export async function paidOrder(w: World) {
  const ids = filledOrder(w);
  const { payToken } = await w.requestPayment.execute(ids.orderId);
  const { paypalOrderId } = await w.preparePayPal.execute(payToken);
  const result = await w.capture.execute(payToken, paypalOrderId);
  return { ...ids, payToken, paypalOrderId, result };
}

export const typesOf = (w: World, orderId: string) => w.events.listByOrder(orderId).map((e) => e.type);
