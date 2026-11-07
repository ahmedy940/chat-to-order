import type { DraftRepository } from "@/application/ports/DraftRepository";
import { Draft } from "@/domain/Draft";
import type { DraftKind } from "@/domain/types";
import type { Db } from "./database";

interface Row {
  conversation_id: string;
  id: string;
  kind: string;
  text: string;
  options_json: string;
  order_id: string | null;
  pay_token: string | null;
}

/** One row per conversation: saving a new draft replaces the old one. */
export class SqliteDraftRepository implements DraftRepository {
  constructor(private readonly db: Db) {}

  get(conversationId: string): Draft | null {
    const row = this.db
      .prepare<[string], Row>("SELECT * FROM drafts WHERE conversation_id = ?")
      .get(conversationId);
    return row
      ? Draft.restore({
          id: row.id,
          conversationId: row.conversation_id,
          kind: row.kind as DraftKind,
          text: row.text,
          options: JSON.parse(row.options_json) as string[],
          orderId: row.order_id,
          payToken: row.pay_token,
        })
      : null;
  }

  save(draft: Draft): void {
    const s = draft.snapshot();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO drafts (conversation_id, id, kind, text, options_json, order_id, pay_token)
         VALUES (@conversationId, @id, @kind, @text, @options, @orderId, @payToken)`,
      )
      .run({ ...s, options: JSON.stringify(s.options) });
  }

  clear(conversationId: string): void {
    this.db.prepare("DELETE FROM drafts WHERE conversation_id = ?").run(conversationId);
  }
}
