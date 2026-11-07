import { describe, expect, it } from "vitest";
import { Conversation } from "@/domain/Conversation";
import { ConversationNotFound, InvalidMessage } from "@/domain/errors";
import { chatWorld } from "../fakes/world";

const say = (text: string, clientId: string, conversationId: string | null = null) => ({
  conversationId,
  clientId,
  text,
});

describe("ReceiveCustomerMessage", () => {
  it("starts a new conversation under a made-up name and saves the message", () => {
    const w = chatWorld();
    const { conversationId } = w.receive.execute(say("hi, 2 of the beige linen dress please", "client-0001"));

    const view = w.customerView.execute(conversationId);
    expect(view.customerName).toBe("Maya Brooks");
    expect(view.messages.map((m) => [m.direction, m.text])).toEqual([
      ["in", "hi, 2 of the beige linen dress please"],
    ]);
  });

  it("saves a repeated client ID only once", () => {
    const w = chatWorld();
    const first = w.receive.execute(say("hello", "client-0001"));
    const again = w.receive.execute(say("hello", "client-0001"));

    expect(again).toEqual(first);
    expect(w.messages.count()).toBe(1);
    expect(w.conversations.count()).toBe(1);
  });

  it("gives a new customer the next made-up name", () => {
    const w = chatWorld();
    w.receive.execute(say("hello", "client-0001"));
    const second = w.receive.execute(say("hi there", "client-0002"));

    expect(w.customerView.execute(second.conversationId).customerName).toBe("Daniel Kim");
  });

  it("adds to an existing conversation", () => {
    const w = chatWorld();
    const { conversationId } = w.receive.execute(say("hello", "client-0001"));
    w.clock.advance(5);
    w.receive.execute(say("size M please", "client-0002", conversationId));

    expect(w.customerView.execute(conversationId).messages.map((m) => m.text)).toEqual([
      "hello",
      "size M please",
    ]);
  });

  it("rejects an empty message without creating a conversation", () => {
    const w = chatWorld();
    expect(() => w.receive.execute(say("   ", "client-0001"))).toThrow(InvalidMessage);
    expect(w.conversations.count()).toBe(0);
  });

  it("refuses a conversation that doesn't exist", () => {
    const w = chatWorld();
    expect(() => w.receive.execute(say("hello", "client-0001", "missing"))).toThrow(ConversationNotFound);
  });
});

describe("SendReply", () => {
  it("shows the seller's reply on the customer phone", () => {
    const w = chatWorld();
    const { conversationId } = w.receive.execute(say("hello", "client-0001"));
    w.clock.advance(5);
    w.reply.execute({ conversationId, clientId: "client-0002", text: "Hi! Which size?" });

    expect(w.customerView.execute(conversationId).messages.map((m) => [m.direction, m.text])).toEqual([
      ["in", "hello"],
      ["out", "Hi! Which size?"],
    ]);
  });

  it("sends a double-tapped reply only once", () => {
    const w = chatWorld();
    const { conversationId } = w.receive.execute(say("hello", "client-0001"));
    const reply = { conversationId, clientId: "client-0002", text: "Hi!" };

    expect(w.reply.execute(reply)).toEqual(w.reply.execute(reply));
    expect(w.messages.count()).toBe(2);
  });

  it("refuses a conversation that doesn't exist", () => {
    const w = chatWorld();
    const reply = { conversationId: "missing", clientId: "client-0001", text: "Hi!" };
    expect(() => w.reply.execute(reply)).toThrow(ConversationNotFound);
  });
});

describe("Inbox and conversation views", () => {
  it("lists the most recently active customer first, with their last message", () => {
    const w = chatWorld();
    const maya = w.receive.execute(say("hello", "client-0001"));
    w.clock.advance(5);
    w.receive.execute(say("hi there", "client-0002"));
    w.clock.advance(5);
    w.reply.execute({ conversationId: maya.conversationId, clientId: "client-0003", text: "Hi Maya!" });

    const rows = w.inbox.execute();
    expect(rows.map((r) => [r.customerName, r.lastMessage?.text, r.status])).toEqual([
      ["Maya Brooks", "Hi Maya!", "Chatting"],
      ["Daniel Kim", "hi there", "Chatting"],
    ]);
  });

  it("opens the customer phone on the newest conversation", () => {
    const w = chatWorld();
    expect(w.customerView.latestId()).toBeNull();
    w.receive.execute(say("hello", "client-0001"));
    w.clock.advance(5);
    const second = w.receive.execute(say("hi there", "client-0002"));

    expect(w.customerView.latestId()).toBe(second.conversationId);
  });

  it("shows the seller the customer's name and the whole chat", () => {
    const w = chatWorld();
    const { conversationId } = w.receive.execute(say("hello", "client-0001"));
    const view = w.sellerView.execute(conversationId);

    expect(view.customerName).toBe("Maya Brooks");
    expect(view.messages).toHaveLength(1);
    expect(() => w.sellerView.execute("missing")).toThrow(ConversationNotFound);
  });
});

describe("Made-up customer names", () => {
  it("adds a number once the list runs out", () => {
    expect(Conversation.nameFor(0)).toBe("Maya Brooks");
    expect(Conversation.nameFor(8)).toBe("Maya Brooks 2");
  });
});
