import { describe, expect, it } from "vitest";
import { PaymentGatewayError } from "@/application/ports/PaymentGateway";
import { InvalidTransition, RefundNotAllowed } from "@/domain/errors";
import { Order } from "@/domain/Order";
import { DraftKind, EventType, OrderStatus } from "@/domain/types";
import { filledOrder, paidOrder, typesOf } from "../fakes/scenarios";
import { appWorld } from "../fakes/world";

describe("RefundPayment", () => {
  it("refunds a paid order in full: Refunded, the refund ID, −$128.00 on the timeline and a $0.00 balance", async () => {
    const w = appWorld();
    const { conversationId, orderId } = await paidOrder(w);
    const { outcome } = await w.refund.execute(orderId);

    expect(outcome).toBe("refunded");
    const view = w.sellerView.execute(conversationId).order;
    expect(view?.status).toBe(OrderStatus.Refunded);
    expect(view?.payment?.refundId).toBe("REFUND-CAPTURE-PAYPAL0001");
    expect(view?.timeline.at(-1)).toMatchObject({ actor: "You", amount: "−$128.00" });
    expect(Order.balance(w.events.listByOrder(orderId))).toBe(0);
    expect(view?.balance).toBe("$0.00");
    expect(w.drafts.get(conversationId)?.kind).toBe(DraftKind.Refund);
    expect(w.drafts.get(conversationId)?.text).toContain("refunded $128.00");
  });

  it("refunds once even when pressed twice", async () => {
    const w = appWorld();
    const { orderId } = await paidOrder(w);
    await w.refund.execute(orderId);
    const again = await w.refund.execute(orderId);

    expect(again.outcome).toBe("already_refunded");
    expect(w.gateway.refundCalls).toBe(1);
    expect(typesOf(w, orderId).filter((t) => t === EventType.RefundIssued)).toHaveLength(1);
  });

  it("refunds only paid orders", async () => {
    const w = appWorld();
    const { orderId } = filledOrder(w);

    await expect(w.refund.execute(orderId)).rejects.toThrow(RefundNotAllowed);
    expect(w.gateway.refundCalls).toBe(0);
  });

  it("keeps the order Paid and logs why when PayPal refuses", async () => {
    const w = appWorld();
    const { orderId } = await paidOrder(w);
    w.gateway.refuseRefunds = true;

    await expect(w.refund.execute(orderId)).rejects.toThrow(PaymentGatewayError);
    expect(w.orders.get(orderId)?.status).toBe(OrderStatus.Paid);
    const last = w.events.listByOrder(orderId).at(-1);
    expect(last).toMatchObject({ type: EventType.RefundFailed, actor: "paypal" });
    expect(last?.summary).toContain("past its refund window");
    expect(Order.balance(w.events.listByOrder(orderId))).toBe(12800);
  });
});

describe("CancelOrder", () => {
  it("cancels before payment, removes the unsent payment message, and closes the pay link", async () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    const { payToken } = w.requestPayment.execute(orderId);
    w.cancel.execute(orderId);

    expect(w.orders.get(orderId)?.status).toBe(OrderStatus.Cancelled);
    expect(typesOf(w, orderId).at(-1)).toBe(EventType.OrderCancelled);
    expect(w.drafts.get(conversationId)).toBeNull();
    expect(w.payPage.execute(payToken).state).toBe("cancelled");
    await expect(w.preparePayPal.execute(payToken)).rejects.toThrow("cancelled by the shop");
  });

  it("can't cancel a paid order: that's what a refund is for", async () => {
    const w = appWorld();
    const { orderId } = await paidOrder(w);

    expect(() => w.cancel.execute(orderId)).toThrow(InvalidTransition);
    expect(w.orders.get(orderId)?.status).toBe(OrderStatus.Paid);
  });

  it("cancelling twice changes nothing", () => {
    const w = appWorld();
    const { orderId } = filledOrder(w);
    w.cancel.execute(orderId);
    w.cancel.execute(orderId);

    expect(typesOf(w, orderId).filter((t) => t === EventType.OrderCancelled)).toHaveLength(1);
  });

  it("lets a new order start in the same chat after a cancel", () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    w.cancel.execute(orderId);
    const next = w.startOrder.execute(conversationId);

    expect(next.orderId).not.toBe(orderId);
    expect(w.orders.get(next.orderId)?.number).toBe(1002);
  });
});
