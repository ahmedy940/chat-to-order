import type { MessageRepository } from "@/application/ports/MessageRepository";
import { Message } from "@/domain/Message";
import type { MessageDirection, MessageKind } from "@/domain/types";
import type { Db } from "./database";

interface Row {
  id: string;
  conversation_id: string;
  client_id: string;
  direction: string;
  kind: string;
  text: string;
  options_json: string;
  created_at: string;
}

export class SqliteMessageRepository implements MessageRepository {
  constructor(private readonly db: Db) {}

  findByClientId(clientId: string): Message | null {
    const row = this.db.prepare<[string], Row>("SELECT * FROM messages WHERE client_id = ?").get(clientId);
    return row ? toMessage(row) : null;
  }

  add(message: Message): void {
    const s = message.snapshot();
    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, client_id, direction, kind, text, options_json, created_at)
         VALUES (@id, @conversationId, @clientId, @direction, @kind, @text, @options, @createdAt)`,
      )
      .run({ ...s, options: JSON.stringify(s.options), createdAt: s.createdAt.toISOString() });
  }

  listByConversation(conversationId: string): Message[] {
    return this.db
      .prepare<[string], Row>("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid")
      .all(conversationId)
      .map(toMessage);
  }

  latestPerConversation(): Message[] {
    return this.db
      .prepare<[], Row>(
        `SELECT * FROM messages m WHERE m.rowid = (
           SELECT rowid FROM messages WHERE conversation_id = m.conversation_id
           ORDER BY created_at DESC, rowid DESC LIMIT 1)`,
      )
      .all()
      .map(toMessage);
  }
}

function toMessage(row: Row): Message {
  return Message.restore({
    id: row.id,
    conversationId: row.conversation_id,
    clientId: row.client_id,
    direction: row.direction as MessageDirection,
    kind: row.kind as MessageKind,
    text: row.text,
    options: JSON.parse(row.options_json) as string[],
    createdAt: new Date(row.created_at),
  });
}
