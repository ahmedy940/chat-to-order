import type { Clock, IdGenerator } from "@/application/ports/Clock";
import type { ConversationRepository } from "@/application/ports/ConversationRepository";
import type { MessageChannel } from "@/application/ports/MessageChannel";
import type { MessageRepository } from "@/application/ports/MessageRepository";
import type { UnitOfWork } from "@/application/ports/UnitOfWork";
import { GetCustomerConversation, GetSellerConversation } from "@/application/queries/GetConversation";
import { GetInbox } from "@/application/queries/GetInbox";
import { ReceiveCustomerMessage } from "@/application/ReceiveCustomerMessage";
import { SendReply } from "@/application/SendReply";
import { Conversation, type ConversationSnapshot } from "@/domain/Conversation";
import { Message, type MessageSnapshot } from "@/domain/Message";

/** In-memory stand-ins for the database, so use-case tests run instantly and need no files. */
export class InMemoryConversations implements ConversationRepository {
  private readonly rows: ConversationSnapshot[] = [];

  get(id: string): Conversation | null {
    const row = this.rows.find((r) => r.id === id);
    return row ? Conversation.restore(row) : null;
  }

  save(conversation: Conversation): void {
    const snapshot = conversation.snapshot();
    const index = this.rows.findIndex((r) => r.id === snapshot.id);
    if (index === -1) this.rows.push(snapshot);
    else this.rows[index] = snapshot;
  }

  list(): Conversation[] {
    return [...this.rows]
      .reverse()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => Conversation.restore(r));
  }

  latest(): Conversation | null {
    return this.list()[0] ?? null;
  }

  count(): number {
    return this.rows.length;
  }
}

export class InMemoryMessages implements MessageRepository {
  private readonly rows: MessageSnapshot[] = [];

  findByClientId(clientId: string): Message | null {
    const row = this.rows.find((r) => r.clientId === clientId);
    return row ? Message.restore(row) : null;
  }

  add(message: Message): void {
    const snapshot = message.snapshot();
    if (this.findByClientId(snapshot.clientId)) throw new Error("UNIQUE constraint failed: client_id");
    this.rows.push(snapshot);
  }

  listByConversation(conversationId: string): Message[] {
    return this.rows.filter((r) => r.conversationId === conversationId).map((r) => Message.restore(r));
  }

  latestPerConversation(): Message[] {
    const latest = new Map<string, MessageSnapshot>();
    for (const row of this.rows) latest.set(row.conversationId, row);
    return [...latest.values()].map((r) => Message.restore(r));
  }

  count(): number {
    return this.rows.length;
  }
}

export class ImmediateUnitOfWork implements UnitOfWork {
  run<T>(work: () => T): T {
    return work();
  }
}

/** A clock that only moves when the test says so. */
export class FixedClock implements Clock {
  private time = new Date("2026-11-07T15:00:00.000Z").getTime();

  now(): Date {
    return new Date(this.time);
  }

  advance(seconds: number): void {
    this.time += seconds * 1000;
  }
}

export class SequentialIds implements IdGenerator {
  private next = 0;

  newId(): string {
    this.next += 1;
    return `id-${this.next}`;
  }
}

class SavingChannel implements MessageChannel {
  constructor(private readonly messages: MessageRepository) {}

  send(message: Message): void {
    this.messages.add(message);
  }
}

/** The chat use cases wired to in-memory fakes, the same way the container wires the real adapters. */
export function chatWorld() {
  const conversations = new InMemoryConversations();
  const messages = new InMemoryMessages();
  const uow = new ImmediateUnitOfWork();
  const clock = new FixedClock();
  const ids = new SequentialIds();
  const channel = new SavingChannel(messages);
  const repos = { conversations, messages };
  return {
    ...repos,
    clock,
    receive: new ReceiveCustomerMessage({ ...repos, uow, clock, ids }),
    reply: new SendReply({ ...repos, channel, uow, clock, ids }),
    inbox: new GetInbox(repos),
    sellerView: new GetSellerConversation(repos),
    customerView: new GetCustomerConversation(repos),
  };
}
