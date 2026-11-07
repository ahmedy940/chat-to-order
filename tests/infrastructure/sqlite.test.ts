import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ReceiveCustomerMessage } from "@/application/ReceiveCustomerMessage";
import { SendReply } from "@/application/SendReply";
import { GetCustomerConversation } from "@/application/queries/GetConversation";
import { DemoChannel } from "@/infrastructure/channels/DemoChannel";
import { openDatabase, resetDatabase, type Db } from "@/infrastructure/db/database";
import { SqliteConversationRepository } from "@/infrastructure/db/SqliteConversationRepository";
import { SqliteMessageRepository } from "@/infrastructure/db/SqliteMessageRepository";
import { SqliteUnitOfWork } from "@/infrastructure/db/SqliteUnitOfWork";
import { RandomIds, SystemClock } from "@/infrastructure/system";

const folders: string[] = [];

function tempDbFile(): string {
  const folder = mkdtempSync(path.join(tmpdir(), "chat-to-order-"));
  folders.push(folder);
  return path.join(folder, "test.db");
}

function wire(db: Db) {
  const conversations = new SqliteConversationRepository(db);
  const messages = new SqliteMessageRepository(db);
  const deps = { conversations, messages, uow: new SqliteUnitOfWork(db), clock: new SystemClock() };
  const ids = new RandomIds();
  return {
    receive: new ReceiveCustomerMessage({ ...deps, ids }),
    reply: new SendReply({ ...deps, ids, channel: new DemoChannel(messages) }),
    view: new GetCustomerConversation({ conversations, messages }),
  };
}

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe("SQLite storage", () => {
  it("keeps the chat after the database is closed and reopened (a server restart)", () => {
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

  it("saves a repeated client ID once", () => {
    const db = openDatabase(":memory:");
    const app = wire(db);
    const send = { conversationId: null, clientId: "client-0001", text: "hi" };
    const first = app.receive.execute(send);
    expect(app.receive.execute(send)).toEqual(first);
    expect(app.view.execute(first.conversationId).messages).toHaveLength(1);
  });

  it("reset empties everything and restarts order numbers at 1001", () => {
    const db = openDatabase(":memory:");
    const app = wire(db);
    app.receive.execute({ conversationId: null, clientId: "client-0001", text: "hi" });
    resetDatabase(db);

    expect(app.view.latestId()).toBeNull();
    const next = db.prepare("SELECT next_value FROM sequences WHERE name = 'order_number'").pluck().get();
    expect(next).toBe(1001);
  });
});
