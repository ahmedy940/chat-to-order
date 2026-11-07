import { describe, expect, it } from "vitest";
import { InvalidTransition, OrderLocked, OrderNotPayable, RefundNotAllowed } from "@/domain/errors";
import { Order } from "@/domain/Order";
import { EventType, ItemField, OrderStatus } from "@/domain/types";
import {
  FEE,
  at,
  awaitingPaymentOrder,
  blankOrder,
  capture,
  completeOrder,
  paidOrder,
} from "./orderFixtures";

const found = (value: string) => ({ value, status: "found" as const, quote: value });

describe("Order total and open details", () => {
  it("adds quantity × unit price plus the delivery fee", () => {
    expect(completeOrder().total().format()).toBe("$128.00");
  });

  it("counts a line as zero while its price is missing", () => {
    const order = blankOrder();
    order.settle(at(ItemField.Quantity), "2");
    order.settle(FEE, "8");
    expect(order.total().cents).toBe(800);
    expect(order.openDetails().map((d) => d.field)).toEqual(["product", "unit_price"]);
  });

  it("allows payment only when nothing is missing and the total is above $0", () => {
    expect(blankOrder().paymentBlocker()).toBe("4 to settle before requesting payment.");
    expect(Order.open("o", 1001, "c").paymentBlocker()).toBe("Add an item first.");
    expect(completeOrder().canRequestPayment()).toBe(true);
  });
});

describe("Reading and settling", () => {
  it("fills items from an AI reading, adding items by position", () => {
    const order = Order.open("o", 1001, "c");
    let next = 0;
    const event = order.applyReading(
      {
        items: [{ product: found("Beige linen dress"), quantity: found("2") }, { product: found("Scarf") }],
        deliveryFee: null,
      },
      () => `item-${++next}`,
    );
    expect(order.items().map((item) => item.id)).toEqual(["item-1", "item-2"]);
    expect(event.type).toBe(EventType.OrderRead);
    expect(event.summary).toBe("Order read: 2 item(s), 4 to settle");
  });

  it("keeps the seller's values when the AI reads again", () => {
    const order = blankOrder();
    order.settle(at(ItemField.UnitPrice), "60");
    order.applyReading({ items: [{ unit_price: found("45") }], deliveryFee: null }, () => "x");
    expect(order.items()[0]?.detail(ItemField.UnitPrice)?.value).toBe("60.00");
  });

  it("takes a tapped option as the customer's answer and hands the order back to the seller", () => {
    const order = blankOrder();
    order.askCustomer(at(ItemField.Size), ["S", "M"]);
    order.markQuestionSent("Which size, S or M?");
    expect(order.status).toBe(OrderStatus.WaitingForCustomer);
    expect(order.answerOption(at(ItemField.Size), "L")).toBeNull();
    expect(order.answerOption(at(ItemField.Size), "M")?.actor).toBe("customer");
    expect(order.status).toBe(OrderStatus.Draft);
  });
});

describe("Requesting payment", () => {
  it("freezes the total and locks the items", () => {
    const order = completeOrder();
    expect(order.requestPayment("token-1")?.type).toBe(EventType.PaymentRequested);
    expect(order.status).toBe(OrderStatus.AwaitingPayment);
    expect(order.snapshot().frozenTotalCents).toBe(12800);
    expect(() => order.settle(at(ItemField.Quantity), "3")).toThrow(OrderLocked);
  });

  it("opens one pay link when pressed twice", () => {
    const order = awaitingPaymentOrder();
    expect(order.requestPayment("token-2")).toBeNull();
    expect(order.payToken).toBe("token-abc");
  });

  it("refuses while details are missing", () => {
    expect(() => blankOrder().requestPayment("t")).toThrow(OrderNotPayable);
  });
});

describe("Paying", () => {
  it("marks Paid only for exactly the frozen total, with the payer's details", () => {
    const order = awaitingPaymentOrder();
    const event = order.markPaid(capture());
    expect(order.status).toBe(OrderStatus.Paid);
    expect(event).toMatchObject({
      type: EventType.PaymentCaptured,
      amountCents: 12800,
      feeCents: 410,
      netCents: 12390,
    });
    expect(order.payment?.payer?.name).toBe("Sarah Lee");
  });

  it("does nothing when the same capture arrives twice", () => {
    const order = paidOrder();
    expect(order.markPaid(capture())).toBeNull();
    expect(order.status).toBe(OrderStatus.Paid);
  });

  it.each([{ amountCents: 9900 }, { currency: "EUR" }, { status: "PENDING" }])(
    "flags a mismatch (%o) and stays Awaiting payment",
    (overrides) => {
      const order = awaitingPaymentOrder();
      expect(order.markPaid(capture(overrides))?.type).toBe(EventType.PaymentMismatch);
      expect(order.status).toBe(OrderStatus.AwaitingPayment);
      expect(order.amountMismatch).toBe(true);
    },
  );

  it("can't be paid before payment is requested", () => {
    expect(() => completeOrder().markPaid(capture())).toThrow(InvalidTransition);
  });
});

describe("Refunding and cancelling", () => {
  const refund = { refundId: "REFUND-1", status: "COMPLETED", amountCents: 12800 };

  it("refunds only paid orders, once", () => {
    expect(() => awaitingPaymentOrder().assertRefundable()).toThrow(RefundNotAllowed);
    const order = paidOrder();
    expect(order.markRefunded(refund)).toMatchObject({ type: EventType.RefundIssued, amountCents: -12800 });
    expect(order.status).toBe(OrderStatus.Refunded);
    expect(order.markRefunded(refund)).toBeNull();
  });

  it("keeps the order Paid when PayPal refuses the refund", () => {
    const order = paidOrder();
    expect(order.refundFailed("Refund window passed").type).toBe(EventType.RefundFailed);
    expect(order.status).toBe(OrderStatus.Paid);
  });

  it("cancels only before payment, once", () => {
    const order = awaitingPaymentOrder();
    expect(order.cancel()?.type).toBe(EventType.OrderCancelled);
    expect(order.cancel()).toBeNull();
    expect(() => paidOrder().cancel()).toThrow(InvalidTransition);
  });
});

describe("Balance from the timeline's money lines", () => {
  it("equals the total when paid and $0.00 when refunded", () => {
    const order = completeOrder();
    const events = [order.requestPayment("t"), order.markPaid(capture())].filter((e) => e !== null);
    expect(Order.balance(events)).toBe(order.total().cents);
    const refunded = order.markRefunded({ refundId: "R", status: "COMPLETED", amountCents: 12800 });
    expect(Order.balance([...events, refunded!])).toBe(0);
  });
});

describe("Snapshots", () => {
  it("restores exactly what was saved", () => {
    const order = paidOrder();
    expect(Order.restore(order.snapshot()).snapshot()).toEqual(order.snapshot());
  });
});
