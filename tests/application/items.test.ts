import { describe, expect, it } from "vitest";
import { LastItem } from "@/domain/errors";
import { DraftKind, EventType, ItemField, OrderStatus } from "@/domain/types";
import { filledOrder, startedOrder, typesOf } from "../fakes/scenarios";
import { appWorld } from "../fakes/world";

/** Found by the learner in step 7: an item added by mistake blocked payment and couldn't be removed. */
describe("Removing an item from the order card", () => {
  it("removes an item added by mistake, records it, and payment can be requested", async () => {
    const w = appWorld();
    const { orderId, itemId } = filledOrder(w);
    const { itemId: extra } = w.addItem.execute(orderId);
    expect(w.orders.get(orderId)?.paymentBlocker()).not.toBeNull();

    w.removeItem.execute({ orderId, itemId: extra });
    expect(
      w.orders
        .get(orderId)
        ?.items()
        .map((item) => item.id),
    ).toEqual([itemId]);
    expect(typesOf(w, orderId)).toContain(EventType.ItemRemoved);

    await w.requestPayment.execute(orderId);
    expect(w.orders.get(orderId)?.status).toBe(OrderStatus.AwaitingPayment);
  });

  it("keeps the order's only item", () => {
    const w = appWorld();
    const { orderId, itemId } = startedOrder(w);
    expect(() => w.removeItem.execute({ orderId, itemId })).toThrow(LastItem);
  });

  it("drops a question in the reply box about the removed item", async () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    const { itemId: extra } = w.addItem.execute(orderId);
    const options = ["Linen dress", "Linen shirt"];
    await w.askCustomer.execute({ orderId, itemId: extra, field: ItemField.Product, options });
    expect(w.drafts.get(conversationId)?.kind).toBe(DraftKind.Question);

    w.removeItem.execute({ orderId, itemId: extra });
    expect(w.drafts.get(conversationId)).toBeNull();
  });

  it("keeps a question about another item that is still on the card", async () => {
    const w = appWorld();
    const { conversationId, orderId, itemId } = startedOrder(w);
    const { itemId: extra } = w.addItem.execute(orderId);
    const options = ["Linen dress", "Linen shirt"];
    await w.askCustomer.execute({ orderId, itemId, field: ItemField.Product, options });

    w.removeItem.execute({ orderId, itemId: extra });
    expect(w.drafts.get(conversationId)?.kind).toBe(DraftKind.Question);
  });
});
