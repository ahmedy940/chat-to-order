import { describe, expect, it } from "vitest";
import { AiUnavailable } from "@/application/ports/AiProvider";
import { DraftKind, EventType, Intent, OrderStatus, ProposalKind } from "@/domain/types";
import { found, missing } from "../fakes/fakeAi";
import { filledOrder, paidOrder, typesOf } from "../fakes/scenarios";
import { appWorld } from "../fakes/world";

type World = ReturnType<typeof appWorld>;
const RETURN_TEXT = "sorry, can I return them?";

/** The customer writes again (a few seconds later). */
function customerWrites(w: World, conversationId: string, text: string, clientId: string) {
  w.clock.advance(5);
  w.receive.execute({ conversationId, clientId, text });
}

/** A paid order, then the customer asks to return it and the AI reads that as a refund request. */
async function returnRequested(w: World) {
  const paid = await paidOrder(w);
  w.ai.intent = { intent: Intent.RefundRequest, quote: RETURN_TEXT };
  customerWrites(w, paid.conversationId, RETURN_TEXT, "client-0090");
  return paid;
}

const proposalOf = (w: World, conversationId: string) => w.sellerView.execute(conversationId).proposal;

describe("The agent pass", () => {
  it("proposes Request payment once nothing is missing, without spending an AI call", async () => {
    const w = appWorld();
    const { conversationId } = filledOrder(w);
    await w.agent.execute(conversationId);

    expect(proposalOf(w, conversationId)).toMatchObject({
      kind: ProposalKind.RequestPayment,
      title: "Request payment for #1001?",
    });
    expect(w.ai.intentsAsked).toHaveLength(0);
    expect(w.inbox.execute()[0]).toMatchObject({ conversationId, hasProposal: true });
  });

  it("proposes a refund, quoting the customer, when a paid order's customer asks to return it", async () => {
    const w = appWorld();
    const { conversationId, orderId } = await returnRequested(w);
    await w.agent.execute(conversationId);

    expect(proposalOf(w, conversationId)).toMatchObject({
      kind: ProposalKind.Refund,
      title: "Refund #1001 · $128.00?",
      quote: RETURN_TEXT,
      confirm: "Refund $128.00 to Sarah Lee? This can't be undone.",
    });
    expect(w.events.listByOrder(orderId).at(-1)).toMatchObject({
      type: EventType.RefundProposed,
      actor: "agent",
    });
  });

  it("runs once per customer message, even when two polls arrive together", async () => {
    const w = appWorld();
    const { conversationId } = await returnRequested(w);
    await Promise.all([w.agent.execute(conversationId), w.agent.execute(conversationId)]);
    await w.agent.execute(conversationId);

    expect(w.ai.intentsAsked).toHaveLength(1);
    expect(w.proposals.all().filter((p) => p.status === "open")).toHaveLength(1);
  });

  it("proposes nothing when the AI is unavailable, and the order card still works", async () => {
    const w = appWorld();
    const { conversationId, orderId } = await returnRequested(w);
    w.ai.failure = new AiUnavailable(true, "429");
    await w.agent.execute(conversationId);
    await w.agent.execute(conversationId);

    expect(proposalOf(w, conversationId)).toBeNull();
    expect(w.ai.intentsAsked).toHaveLength(1);
    await w.refund.execute(orderId);
    expect(w.orders.get(orderId)?.status).toBe(OrderStatus.Refunded);
  });

  it("proposes a reminder when the customer writes but hasn't paid yet", async () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    await w.requestPayment.execute(orderId);
    customerWrites(w, conversationId, "is the beige one nice?", "client-0091");
    await w.agent.execute(conversationId);

    expect(proposalOf(w, conversationId)?.kind).toBe(ProposalKind.Remind);
  });

  it("looks again after Read order fills in the card", async () => {
    const w = appWorld();
    const { conversationId } = w.receive.execute({
      conversationId: null,
      clientId: "client-0001",
      text: "2 linen dresses",
    });
    await w.agent.execute(conversationId);
    expect(proposalOf(w, conversationId)).toBeNull();
    const item = {
      product: found("Linen dress", "2 linen dresses"),
      size: missing(),
      quantity: found("2", "2 linen dresses"),
      unit_price: missing(),
    };
    w.ai.reading = { reading: { items: [item], deliveryFee: missing() }, question: "Which size?" };
    await w.readOrder.execute(conversationId);
    await w.agent.execute(conversationId);

    expect(proposalOf(w, conversationId)).toMatchObject({
      kind: ProposalKind.Ask,
      reason: "Still missing: size.",
    });
  });
});

describe("Approving and dismissing", () => {
  it("approving the refund refunds the order's own amount through PayPal, once, and logs it", async () => {
    const w = appWorld();
    const { conversationId, orderId } = await returnRequested(w);
    await w.agent.execute(conversationId);
    const id = proposalOf(w, conversationId)?.id ?? "";

    expect(await w.approve.execute(id)).toEqual({ outcome: "approved" });
    expect(await w.approve.execute(id)).toEqual({ outcome: "already_decided" });
    expect(w.orders.get(orderId)?.status).toBe(OrderStatus.Refunded);
    expect(w.gateway.refundCalls).toBe(1);
    expect(
      w.events
        .listByOrder(orderId)
        .slice(-3)
        .map((e) => [e.type, e.amountCents]),
    ).toEqual([
      [EventType.RefundProposed, null],
      [EventType.RefundIssued, -12800],
      [EventType.ProposalApproved, null],
    ]);
    expect(proposalOf(w, conversationId)).toBeNull();
  });

  it("approving Request payment freezes the order's total and drafts the payment message", async () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    await w.agent.execute(conversationId);
    await w.approve.execute(proposalOf(w, conversationId)?.id ?? "");

    expect(w.orders.get(orderId)?.status).toBe(OrderStatus.AwaitingPayment);
    expect(w.drafts.get(conversationId)?.snapshot()).toMatchObject({ kind: DraftKind.Payment });
    expect(w.drafts.get(conversationId)?.text).toContain("$128.00");
    expect(typesOf(w, orderId).slice(-2)).toEqual([EventType.PaymentRequested, EventType.ProposalApproved]);
  });

  it("approving a reminder drafts a nudge with the same pay link", async () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    const { payToken } = await w.requestPayment.execute(orderId);
    customerWrites(w, conversationId, "hello?", "client-0092");
    await w.agent.execute(conversationId);
    await w.approve.execute(proposalOf(w, conversationId)?.id ?? "");

    expect(w.drafts.get(conversationId)?.payToken).toBe(payToken);
    expect(w.drafts.get(conversationId)?.text).toContain("Just a friendly reminder");
  });

  it("dismiss hides the proposal until the customer writes again", async () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    await w.agent.execute(conversationId);
    w.dismiss.execute(proposalOf(w, conversationId)?.id ?? "");
    await w.agent.execute(conversationId);

    expect(proposalOf(w, conversationId)).toBeNull();
    expect(typesOf(w, orderId).at(-1)).toBe(EventType.ProposalDismissed);
    customerWrites(w, conversationId, "any news?", "client-0093");
    await w.agent.execute(conversationId);
    expect(proposalOf(w, conversationId)?.kind).toBe(ProposalKind.RequestPayment);
  });

  it("keeps the proposal open when PayPal refuses the refund", async () => {
    const w = appWorld();
    const { conversationId, orderId } = await returnRequested(w);
    await w.agent.execute(conversationId);
    w.gateway.refuseRefunds = true;
    const id = proposalOf(w, conversationId)?.id ?? "";

    await expect(w.approve.execute(id)).rejects.toThrow("refund window");
    expect(proposalOf(w, conversationId)?.id).toBe(id);
    expect(w.orders.get(orderId)?.status).toBe(OrderStatus.Paid);
  });
});
