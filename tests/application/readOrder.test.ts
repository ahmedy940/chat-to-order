import { describe, expect, it } from "vitest";
import { AiUnavailable, type ReadOrderOutput } from "@/application/ports/AiProvider";
import { DraftOutdated, OptionsNotAllowed, OrderLocked } from "@/domain/errors";
import { DetailStatus, DraftKind, EventType, ItemField, MessageKind, OrderStatus } from "@/domain/types";
import { found, missing } from "../fakes/fakeAi";
import { filledOrder, typesOf } from "../fakes/scenarios";
import { appWorld, PAY_BASE } from "../fakes/world";

type World = ReturnType<typeof appWorld>;
const ORDER_TEXT = "hi, 2 of the beige linen dress please";

/** What the pretend AI reads from ORDER_TEXT: product, colour and quantity found; size and prices missing. */
function linenDressReading(): ReadOrderOutput {
  return {
    reading: {
      items: [
        {
          product: found("Linen dress", ORDER_TEXT),
          variant: found("Beige", ORDER_TEXT),
          size: missing(),
          quantity: found("2", ORDER_TEXT),
          unit_price: missing(),
        },
      ],
      deliveryFee: missing(),
    },
    question: "Hi! Lovely choice. What size would you like?",
  };
}

/** A customer writes ORDER_TEXT and the seller taps Read order. */
async function readChat(w: World) {
  const { conversationId } = w.receive.execute({
    conversationId: null,
    clientId: "client-0001",
    text: ORDER_TEXT,
  });
  w.ai.reading = linenDressReading();
  const { orderId } = await w.readOrder.execute(conversationId);
  const itemId = w.orders.get(orderId)?.items()[0]?.id ?? "";
  return { conversationId, orderId, itemId };
}

const detail = (w: World, orderId: string, field: ItemField) =>
  w.orders.get(orderId)?.items()[0]?.detail(field);

describe("Read order", () => {
  it("fills a new card from the chat, with quotes, and a price never written stays Missing", async () => {
    const w = appWorld();
    const { conversationId, orderId } = await readChat(w);

    expect(w.orders.get(orderId)?.number).toBe(1001);
    expect(detail(w, orderId, ItemField.Product)?.snapshot()).toMatchObject({
      value: "Linen dress",
      sourceQuote: ORDER_TEXT,
    });
    expect(detail(w, orderId, ItemField.UnitPrice)?.status).toBe(DetailStatus.Missing);
    expect(typesOf(w, orderId)).toEqual([EventType.OrderRead]);
    expect(w.drafts.get(conversationId)?.snapshot()).toMatchObject({ kind: DraftKind.Question, byAi: true });
  });

  it("never overwrites what the seller set, and tells the AI about it", async () => {
    const w = appWorld();
    const { conversationId, orderId, itemId } = await readChat(w);
    w.settle.execute({ orderId, itemId, field: ItemField.UnitPrice, value: "60" });
    w.receive.execute({ conversationId, clientId: "client-0002", text: "actually make it 3" });
    const firstItem = w.ai.reading.reading.items[0];
    w.ai.reading.reading.items[0] = { ...firstItem, unit_price: found("70", "70?") };
    await w.readOrder.execute(conversationId);

    expect(detail(w, orderId, ItemField.UnitPrice)?.snapshot()).toMatchObject({
      value: "60.00",
      status: DetailStatus.SetByYou,
    });
    expect(w.ai.asked.read.at(-1)?.settled).toEqual(["Item 1 price: $60.00"]);
  });

  it("saves nothing when the AI fails, and says why", async () => {
    const w = appWorld();
    const { conversationId } = w.receive.execute({
      conversationId: null,
      clientId: "client-0001",
      text: ORDER_TEXT,
    });
    w.ai.failure = new AiUnavailable(true, "429");
    await expect(w.readOrder.execute(conversationId)).rejects.toThrow(
      "The AI is busy. Try again in a minute.",
    );
    w.ai.failure = new AiUnavailable(false, "timeout");
    await expect(w.readOrder.execute(conversationId)).rejects.toThrow(
      "Couldn't read this conversation. Try again.",
    );

    expect(w.orders.latestForConversation(conversationId)).toBeNull();
    expect(w.drafts.get(conversationId)).toBeNull();
  });

  it("offers Read again only after new customer messages", async () => {
    const w = appWorld();
    const { conversationId } = await readChat(w);
    expect(w.sellerView.execute(conversationId).readAction).toBeNull();
    w.clock.advance(5);
    w.receive.execute({ conversationId, clientId: "client-0002", text: "size M" });

    expect(w.sellerView.execute(conversationId).readAction).toBe("Read again");
  });

  it("never re-reads an order once payment was requested (its items are frozen)", async () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    await w.requestPayment.execute(orderId);

    await expect(w.readOrder.execute(conversationId)).rejects.toThrow(OrderLocked);
    expect(w.sellerView.execute(conversationId).readAction).toBeNull();
  });

  it("reads only what was said after the last finished order", async () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    w.cancel.execute(orderId);
    w.clock.advance(60);
    w.receive.execute({ conversationId, clientId: "client-0002", text: "new order: one white shirt" });
    w.ai.reading = linenDressReading();
    const next = await w.readOrder.execute(conversationId);

    expect(w.ai.asked.read.at(-1)?.chat).toEqual([{ from: "customer", text: "new order: one white shirt" }]);
    expect(w.orders.get(next.orderId)?.number).toBe(1002);
  });
});

describe("Ask customer and the drafted question", () => {
  it("offers up to 3 options, never for a price, and sends them as buttons with the AI's question", async () => {
    const w = appWorld();
    const { conversationId, orderId, itemId } = await readChat(w);
    const ask = (field: ItemField, options: string[]) =>
      w.askCustomer.execute({ orderId, itemId, field, options });

    await expect(ask(ItemField.Size, ["S", "M", "L", "XL"])).rejects.toThrow(OptionsNotAllowed);
    await expect(ask(ItemField.UnitPrice, ["50", "60"])).rejects.toThrow(OptionsNotAllowed);
    await ask(ItemField.Size, ["S", "M"]);

    expect(w.drafts.get(conversationId)?.snapshot()).toMatchObject({ options: ["S", "M"], byAi: true });
    expect(w.ai.asked.questions.at(-1)?.asks).toEqual([{ label: "Size", options: ["S", "M"] }]);
  });

  it("falls back to a plain question when the AI is down", async () => {
    const w = appWorld();
    const { conversationId, orderId, itemId } = await readChat(w);
    w.ai.failure = new AiUnavailable(false, "down");
    await w.askCustomer.execute({ orderId, itemId, field: ItemField.Size, options: ["S", "M"] });

    expect(w.drafts.get(conversationId)?.snapshot()).toMatchObject({
      text: "Thanks! Could you tell us which size you'd like (S or M)?",
      byAi: false,
    });
  });

  it("sending the question makes the order wait for the customer, and each draft sends once", async () => {
    const w = appWorld();
    const { conversationId, orderId, itemId } = await readChat(w);
    await w.askCustomer.execute({ orderId, itemId, field: ItemField.Size, options: ["S", "M"] });
    const draft = w.drafts.get(conversationId);
    const send = (clientId: string) =>
      w.reply.execute({ conversationId, clientId, text: draft?.text ?? "", draftId: draft?.id });
    send("client-0002");

    expect(w.orders.get(orderId)?.status).toBe(OrderStatus.WaitingForCustomer);
    expect(typesOf(w, orderId).at(-1)).toBe(EventType.QuestionSent);
    expect(w.customerView.execute(conversationId).messages.at(-1)?.options).toEqual(["S", "M"]);
    expect(() => send("client-0003")).toThrow(DraftOutdated);
  });

  it("a tapped option settles its detail as the customer's answer and hands the order back", async () => {
    const w = appWorld();
    const { conversationId, orderId, itemId } = await readChat(w);
    await w.askCustomer.execute({ orderId, itemId, field: ItemField.Size, options: ["S", "M"] });
    const draft = w.drafts.get(conversationId);
    w.reply.execute({ conversationId, clientId: "client-0002", text: draft?.text ?? "", draftId: draft?.id });
    w.receive.execute({ conversationId, clientId: "client-0003", text: "M", option: true });

    expect(detail(w, orderId, ItemField.Size)?.snapshot()).toMatchObject({
      value: "M",
      status: DetailStatus.Found,
    });
    expect(w.orders.get(orderId)?.status).toBe(OrderStatus.Draft);
    expect(w.events.listByOrder(orderId).at(-1)).toMatchObject({
      type: EventType.DetailSet,
      actor: "customer",
    });
    expect(w.customerView.execute(conversationId).messages.at(-1)?.kind).toBe(MessageKind.OptionReply);
  });
});

describe("The payment message", () => {
  it("has the AI's opening line, but the number, total and link always come from our code", async () => {
    const w = appWorld();
    const { conversationId, orderId } = filledOrder(w);
    w.ai.leadIn = "Thank you so much for your order!";
    const { payToken } = await w.requestPayment.execute(orderId);

    const draft = w.drafts.get(conversationId)?.snapshot();
    expect(draft?.text).toBe(
      `Thank you so much for your order!\n\nOrder #1001 · total $128.00\nPay securely here: ${PAY_BASE}${payToken}`,
    );
    expect(draft?.byAi).toBe(true);
    expect(w.ai.asked.leadIns[0]).toEqual({
      customerName: "Maya Brooks",
      items: "2 × Beige linen dress (M)",
    });
  });
});
