import { describe, expect, it } from "vitest";
import { NextActionPolicy } from "@/domain/NextActionPolicy";
import { Intent, ItemField, ProposalKind } from "@/domain/types";
import { FEE, at, awaitingPaymentOrder, blankOrder, completeOrder, paidOrder } from "./orderFixtures";

const policy = new NextActionPolicy();
const quote = "can I return them?";

describe("NextActionPolicy", () => {
  it("proposes nothing when the AI is unavailable or there's no order", () => {
    expect(policy.propose({ intent: null, quote, order: paidOrder() })).toBeNull();
    expect(policy.propose({ intent: Intent.OrderDetails, quote, order: null })).toBeNull();
  });

  it("asks only for details the customer can answer", () => {
    const order = blankOrder();
    order.settle(at(ItemField.Product), "Beige linen dress");
    order.settle(at(ItemField.Quantity), "2");
    order.settle(at(ItemField.UnitPrice), "60");
    order.settle(FEE, "8");
    order.askCustomer(at(ItemField.Size), ["S", "M"]);
    expect(policy.propose({ intent: Intent.OrderDetails, quote: null, order })).toMatchObject({
      kind: ProposalKind.Ask,
      reason: "Still missing: size.",
    });
  });

  it("proposes nothing when only a price is missing, because the seller types prices", () => {
    const order = blankOrder();
    order.settle(at(ItemField.Product), "Scarf");
    order.settle(at(ItemField.Quantity), "1");
    order.settle(FEE, "0");
    expect(policy.propose({ intent: Intent.Other, quote: null, order })).toBeNull();
  });

  it("proposes Request payment when nothing is missing", () => {
    const proposal = policy.propose({ intent: Intent.ReadyToPay, quote: null, order: completeOrder() });
    expect(proposal?.kind).toBe(ProposalKind.RequestPayment);
    expect(proposal?.reason).toContain("$128.00");
  });

  it("proposes Remind when the customer writes while payment is awaited", () => {
    const order = awaitingPaymentOrder();
    expect(policy.propose({ intent: Intent.PaymentQuestion, quote: "how do I pay?", order })?.kind).toBe(
      ProposalKind.Remind,
    );
    expect(policy.propose({ intent: Intent.RefundRequest, quote, order })).toBeNull();
  });

  it("proposes Refund only on a paid order whose customer asks to return", () => {
    expect(policy.propose({ intent: Intent.RefundRequest, quote, order: paidOrder() })).toMatchObject({
      kind: ProposalKind.Refund,
      quote,
    });
    expect(policy.propose({ intent: Intent.Other, quote: "thanks!", order: paidOrder() })).toBeNull();
    const refunded = paidOrder();
    refunded.markRefunded({ refundId: "R", status: "COMPLETED", amountCents: 12800 });
    expect(policy.propose({ intent: Intent.RefundRequest, quote, order: refunded })).toBeNull();
  });
});
