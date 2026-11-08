import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CancelOrder } from "@/application/CancelOrder";
import { GetCustomerConversation } from "@/application/queries/GetConversation";
import { ListOrders } from "@/application/queries/ListOrders";
import { ReceiveCustomerMessage } from "@/application/ReceiveCustomerMessage";
import { RequestPayment } from "@/application/RequestPayment";
import { ResetDemo } from "@/application/ResetDemo";
import { SendReply } from "@/application/SendReply";
import { SettleDetail } from "@/application/SettleDetail";
import { StartOrder } from "@/application/StartOrder";
import { ItemField, OrderField, OrderStatus } from "@/domain/types";
import { DemoChannel } from "@/infrastructure/channels/DemoChannel";
import { openDatabase, type Db } from "@/infrastructure/db/database";
import { SqliteConversationRepository } from "@/infrastructure/db/SqliteConversationRepository";
import { SqliteDemoStore } from "@/infrastructure/db/SqliteDemoStore";
import { SqliteDraftRepository } from "@/infrastructure/db/SqliteDraftRepository";
import { SqliteMessageRepository } from "@/infrastructure/db/SqliteMessageRepository";
import { SqliteOrderEventRepository } from "@/infrastructure/db/SqliteOrderEventRepository";
import { SqliteOrderRepository } from "@/infrastructure/db/SqliteOrderRepository";
import { SqliteProposalRepository } from "@/infrastructure/db/SqliteProposalRepository";
import { SqliteUnitOfWork } from "@/infrastructure/db/SqliteUnitOfWork";
import { RandomIds, RandomTokens, SystemClock } from "@/infrastructure/system";
import { FakeAiProvider } from "../fakes/fakeAi";

const folders: string[] = [];

function tempDbFile(): string {
  const folder = mkdtempSync(path.join(tmpdir(), "chat-to-order-"));
  folders.push(folder);
  return path.join(folder, "test.db");
}

/** The real SQLite adapters, wired like the container (PayPal isn't needed for these checks). */
function wire(db: Db) {
  const messages = new SqliteMessageRepository(db);
  const a = {
    conversations: new SqliteConversationRepository(db),
    messages,
    orders: new SqliteOrderRepository(db),
    events: new SqliteOrderEventRepository(db),
    drafts: new SqliteDraftRepository(db),
    proposals: new SqliteProposalRepository(db),
    uow: new SqliteUnitOfWork(db),
    clock: new SystemClock(),
    ids: new RandomIds(),
    tokens: new RandomTokens(),
    channel: new DemoChannel(messages),
    ai: new FakeAiProvider(),
    payUrl: (token: string) => `https://shop.test/pay/${token}`,
  };
  return {
    ...a,
    receive: new ReceiveCustomerMessage(a),
    reply: new SendReply(a),
    view: new GetCustomerConversation(a),
    startOrder: new StartOrder(a),
    settle: new SettleDetail(a),
    requestPayment: new RequestPayment(a),
    cancel: new CancelOrder(a),
    listOrders: new ListOrders(a),
    resetDemo: new ResetDemo({ store: new SqliteDemoStore(db) }),
  };
}

/** A customer, and a $128 order filled in by hand: 2 × $60 linen dress (M) + $8 delivery. */
function filledOrder(app: ReturnType<typeof wire>, clientId = "client-0001") {
  const { conversationId } = app.receive.execute({ conversationId: null, clientId, text: "hi" });
  const { orderId } = app.startOrder.execute(conversationId);
  const itemId = app.orders.get(orderId)?.items()[0]?.id ?? "";
  const set = (
    field: ItemField | typeof OrderField.DeliveryFee,
    value: string,
    item: string | null = itemId,
  ) => app.settle.execute({ orderId, itemId: item, field, value });
  set(ItemField.Product, "Beige linen dress");
  set(ItemField.Size, "M");
  set(ItemField.Quantity, "2");
  set(ItemField.UnitPrice, "60");
  set(OrderField.DeliveryFee, "8", null);
  return { conversationId, orderId };
}

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe("SQLite storage", () => {
  it("keeps the chat after the database is closed and reopened (a server restart)", async () => {
    const file = tempDbFile();
    const first = openDatabase(file);
    const app = wire(first);
    const { conversationId } = app.receive.execute({
      conversationId: null,
      clientId: "client-0001",
      text: "hi",
    });
    app.reply.execute({ conversationId, clientId: "client-0002", text: "Hello!" });
    first.close();

    const reopened = openDatabase(file);
    const messages = wire(reopened).view.execute(conversationId).messages;
    expect(messages.map((m) => [m.direction, m.text])).toEqual([
      ["in", "hi"],
      ["out", "Hello!"],
    ]);
    reopened.close();
  });

  it("saves a repeated client ID once", async () => {
    const app = wire(openDatabase(":memory:"));
    const send = { conversationId: null, clientId: "client-0001", text: "hi" };
    const first = app.receive.execute(send);
    expect(app.receive.execute(send)).toEqual(first);
    expect(app.view.execute(first.conversationId).messages).toHaveLength(1);
  });

  it("saves an order and loads back exactly the same order, numbered from #1001", async () => {
    const app = wire(openDatabase(":memory:"));
    const { orderId } = filledOrder(app);
    await app.requestPayment.execute(orderId);

    const order = app.orders.get(orderId);
    expect(order?.number).toBe(1001);
    expect(order?.total().format()).toBe("$128.00");
    expect(order?.items()[0]?.summary()).toBe("2 × Beige linen dress (M)");
    expect(app.orders.findByPayToken(order?.payToken ?? "")?.snapshot()).toEqual(order?.snapshot());
    expect(app.events.listByOrder(orderId).map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("never saves a status change without its timeline line (same transaction)", async () => {
    const app = wire(openDatabase(":memory:"));
    const { orderId } = filledOrder(app);
    app.events.append = () => {
      throw new Error("disk full");
    };

    await expect(app.requestPayment.execute(orderId)).rejects.toThrow("disk full");
    const order = app.orders.get(orderId);
    expect(order?.status).toBe(OrderStatus.Draft);
    expect(order?.payToken).toBeNull();
  });

  it("lists every order newest first, with its customer, items, total, status and date", async () => {
    const app = wire(openDatabase(":memory:"));
    const first = filledOrder(app);
    await app.requestPayment.execute(first.orderId);
    const second = filledOrder(app, "client-0002");
    app.cancel.execute(second.orderId);

    const rows = app.listOrders.execute();
    expect(rows.map((r) => [r.number, r.items, r.total, r.statusLabel, r.payer])).toEqual([
      [1002, "2 × Beige linen dress (M)", "$128.00", "Cancelled", null],
      [1001, "2 × Beige linen dress (M)", "$128.00", "Awaiting payment", null],
    ]);
    expect(rows[0]?.conversationId).toBe(second.conversationId);
    expect(rows.every((r) => r.customerName.length > 0 && !Number.isNaN(Date.parse(r.date)))).toBe(true);
  });

  it("Reset demo empties everything and the next order is #1001 again", async () => {
    const app = wire(openDatabase(":memory:"));
    filledOrder(app);
    filledOrder(app, "client-0002");

    expect(app.resetDemo.execute()).toEqual({ reset: true });
    expect(app.view.latestId()).toBeNull();
    expect(app.listOrders.execute()).toEqual([]);
    const { orderId } = filledOrder(app);
    expect(app.orders.get(orderId)?.number).toBe(1001);
  });
});
