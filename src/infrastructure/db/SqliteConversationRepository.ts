import type { ConversationRepository } from "@/application/ports/ConversationRepository";
import { Conversation } from "@/domain/Conversation";
import type { Channel } from "@/domain/types";
import type { Db } from "./database";

interface Row {
  id: string;
  customer_name: string;
  channel: string;
  last_customer_message_id: string | null;
  last_handled_message_id: string | null;
  created_at: string;
}

const NEWEST_FIRST = "ORDER BY created_at DESC, rowid DESC";

export class SqliteConversationRepository implements ConversationRepository {
  constructor(private readonly db: Db) {}

  get(id: string): Conversation | null {
    const row = this.db.prepare<[string], Row>("SELECT * FROM conversations WHERE id = ?").get(id);
    return row ? toConversation(row) : null;
  }

  save(conversation: Conversation): void {
    const s = conversation.snapshot();
    this.db
      .prepare(
        `INSERT INTO conversations (id, customer_name, channel, last_customer_message_id, last_handled_message_id, created_at)
         VALUES (@id, @customerName, @channel, @lastCustomer, @lastHandled, @createdAt)
         ON CONFLICT(id) DO UPDATE SET customer_name = excluded.customer_name,
           last_customer_message_id = excluded.last_customer_message_id,
           last_handled_message_id = excluded.last_handled_message_id`,
      )
      .run({
        id: s.id,
        customerName: s.customerName,
        channel: s.channel,
        lastCustomer: s.lastCustomerMessageId,
        lastHandled: s.lastHandledMessageId,
        createdAt: s.createdAt.toISOString(),
      });
  }

  list(): Conversation[] {
    return this.db.prepare<[], Row>(`SELECT * FROM conversations ${NEWEST_FIRST}`).all().map(toConversation);
  }

  latest(): Conversation | null {
    const row = this.db.prepare<[], Row>(`SELECT * FROM conversations ${NEWEST_FIRST} LIMIT 1`).get();
    return row ? toConversation(row) : null;
  }

  count(): number {
    return this.db.prepare<[], { n: number }>("SELECT COUNT(*) AS n FROM conversations").get()?.n ?? 0;
  }
}

function toConversation(row: Row): Conversation {
  return Conversation.restore({
    id: row.id,
    customerName: row.customer_name,
    channel: row.channel as Channel,
    lastCustomerMessageId: row.last_customer_message_id,
    lastHandledMessageId: row.last_handled_message_id,
    createdAt: new Date(row.created_at),
  });
}
