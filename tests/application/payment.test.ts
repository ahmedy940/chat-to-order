import { describe, expect, it } from "vitest";
import { DraftOutdated, OrderNotPayable, PaymentNotOpen } from "@/domain/errors";
import { Order } from "@/domain/Order";
import { DraftKind, EventType, MessageKind, OrderStatus } from "@/domain/types";
import { filledOrder, paidOrder, startedOrder, typesOf } from "../fakes/scenarios";
import { appWorld, PAY_BASE } from "../fakes/world";

describe("Starting and filling in an order by hand", () => {
  it("numbers orders from #1001 and reuses the conversation's open order", () => {
    const w = appWorld();
    const { conversationId, orderId } = startedOrder(w);

    expect(w.orders.get(orderId)?.number).toBe(1001);
    expect(w.startOrder.execute(conversationId).orderId).toBe(orderId);
  });

  it("keeps the total up to date and logs each typed value on the timeline", () => {
    const w = appWorld();
    const { orderId } = filledOrder(w);

    expect(w.orders.get(orderId)?.total().format()).toBe("$128.00");
    expect(typesOf(w, orderId)).toEqual(Array(5).fill(EventType.DetailSet));
  });
});

describe("RequestPayment", () => {
  it("refuses while something is still missing", () => {
    const w = appWorld();
    const { conversationId, orderId } = startedOrder(w);

    expect(() => w.requestPayment.execute(orderId)).toThrow(OrderNotPayable);
    expect(w.drafts.get(conversationId)).toBeNull();
  });

  it("freezes the order, opens one pay link even when pressed twice, and drafts the payment message", () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    const first = w.requestPayment.execute(orderId);
    const second = w.requestPayment.execute(orderId);

    expect(second).toEqual(first);
    expect(first.payUrl).toBe(`${PAY_BASE}${first.payToken}`);
    expect(w.orders.get(orderId)?.status).toBe(OrderStatus.AwaitingPayment);
    expect(typesOf(w, orderId).filter((t) => t === EventType.PaymentRequested)).toHaveLength(1);
    expect(w.drafts.get(conversationId)?.text).toBe(
      `Here's your order #1001, total $128.00. Pay securely here: ${first.payUrl}`,
    );
  });

  it("sends the payment draft as a pay-link card on the customer phone", () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    w.requestPayment.execute(orderId);
    const draft = w.drafts.get(conversationId);
    w.reply.execute({ conversationId, clientId: "client-0002", text: draft?.text ?? "", draftId: draft?.id });

    const last = w.customerView.execute(conversationId).messages.at(-1);
    expect(last?.kind).toBe(MessageKind.PayLink);
    expect(last?.payLink?.label).toBe("Order #1001 · $128.00");
    expect(w.drafts.get(conversationId)).toBeNull();
  });

  it("refuses to send a draft that was replaced", () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    w.requestPayment.execute(orderId);
    const stale = { conversationId, clientId: "client-0002", text: "old", draftId: "an-old-draft" };

    expect(() => w.reply.execute(stale)).toThrow(DraftOutdated);
  });
});

describe("Paying on the pay page", () => {
  it("creates the PayPal order from the frozen order and reuses it while it can still be paid", async () => {
    const w = appWorld();
    const { orderId } = filledOrder(w);
    const { payToken } = w.requestPayment.execute(orderId);
    const first = await w.preparePayPal.execute(payToken);
    const again = await w.preparePayPal.execute(payToken);

    expect(again).toEqual(first);
    expect(w.gateway.created).toHaveLength(1);
    expect(w.gateway.created[0]).toMatchObject({
      lines: [{ name: "Beige linen dress (M)", quantity: 2, unitAmountCents: 6000 }],
      itemTotalCents: 12000,
      shippingCents: 800,
      totalCents: 12800,
    });
  });

  it("makes a new PayPal order when the old one expired", async () => {
    const w = appWorld();
    const { orderId } = filledOrder(w);
    const { payToken } = w.requestPayment.execute(orderId);
    const first = await w.preparePayPal.execute(payToken);
    w.gateway.expire(first.paypalOrderId);

    expect((await w.preparePayPal.execute(payToken)).paypalOrderId).not.toBe(first.paypalOrderId);
    expect(w.orders.get(orderId)?.payment?.attempt).toBe(2);
  });

  it("marks Paid once, saves the payer, drafts a thank-you, and the balance equals the total", async () => {
    const w = appWorld();
    const { conversationId, orderId, payToken, paypalOrderId, result } = await paidOrder(w);
    const again = await w.capture.execute(payToken, paypalOrderId);

    expect(result.outcome).toBe("paid");
    expect(again.outcome).toBe("already_paid");
    expect(typesOf(w, orderId).filter((t) => t === EventType.PaymentCaptured)).toHaveLength(1);
    expect(Order.balance(w.events.listByOrder(orderId))).toBe(12800);
    const view = w.sellerView.execute(conversationId).order;
    expect(view?.payment).toMatchObject({
      payerName: "Sarah Lee",
      shipAddress: "1 Main St, Brooklyn, NY 11201, US",
    });
    expect(view?.timeline.at(-1)).toMatchObject({ actor: "PayPal", amount: "+$128.00", fee: "$4.10" });
    expect(w.drafts.get(conversationId)?.kind).toBe(DraftKind.Thanks);
  });

  it("keeps a wrong amount Awaiting payment and flags it", async () => {
    const w = appWorld();
    w.gateway.captureOverride = { amountCents: 100 };
    const { orderId, result } = await paidOrder(w);

    expect(result.outcome).toBe("mismatch");
    expect(w.orders.get(orderId)?.status).toBe(OrderStatus.AwaitingPayment);
    expect(w.orders.get(orderId)?.amountMismatch).toBe(true);
    expect(typesOf(w, orderId)).toContain(EventType.PaymentMismatch);
  });

  it("won't capture a PayPal order that belongs to something else", async () => {
    const w = appWorld();
    const { orderId } = filledOrder(w);
    const { payToken } = w.requestPayment.execute(orderId);
    await w.preparePayPal.execute(payToken);

    await expect(w.capture.execute(payToken, "SOMEONEELSE1")).rejects.toThrow(PaymentNotOpen);
    await expect(w.preparePayPal.execute("no-such-token")).rejects.toThrow("pay link");
  });

  it("shows the pay page the frozen order, and won't take payment twice", async () => {
    const w = appWorld();
    const { payToken } = await paidOrder(w);
    const page = w.payPage.execute(payToken);

    expect(page).toMatchObject({ orderNumber: 1001, state: "paid", deliveryFee: "$8.00", total: "$128.00" });
    expect(page.lines).toEqual([
      { name: "Beige linen dress (M)", quantity: 2, unitPrice: "$60.00", lineTotal: "$120.00" },
    ]);
    await expect(w.preparePayPal.execute(payToken)).rejects.toThrow("already paid");
  });
});
