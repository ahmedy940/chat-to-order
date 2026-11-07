import type { ProposalRepository } from "@/application/ports/ProposalRepository";
import { Proposal, ProposalStatus } from "@/domain/Proposal";
import type { ProposalKind } from "@/domain/types";
import type { Db } from "./database";

interface Row {
  id: string;
  conversation_id: string;
  order_id: string | null;
  kind: string;
  reason: string;
  quote: string | null;
  based_on_message_id: string | null;
  status: string;
  created_at: string;
}

const UPSERT = `
  INSERT INTO proposals (id, conversation_id, order_id, kind, reason, quote, based_on_message_id, status, created_at)
  VALUES (@id, @conversationId, @orderId, @kind, @reason, @quote, @basedOnMessageId, @status, @createdAt)
  ON CONFLICT(id) DO UPDATE SET status = excluded.status`;

/** The agent's proposals. Decided ones stay as a record; open ones nobody acted on are replaced. */
export class SqliteProposalRepository implements ProposalRepository {
  constructor(private readonly db: Db) {}

  get(id: string): Proposal | null {
    const row = this.db.prepare<[string], Row>("SELECT * FROM proposals WHERE id = ?").get(id);
    return row ? toProposal(row) : null;
  }

  openFor(conversationId: string): Proposal | null {
    const sql =
      "SELECT * FROM proposals WHERE conversation_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1";
    const row = this.db.prepare<[string, string], Row>(sql).get(conversationId, ProposalStatus.Open);
    return row ? toProposal(row) : null;
  }

  save(proposal: Proposal): void {
    const s = proposal.snapshot();
    this.db.prepare(UPSERT).run({ ...s, createdAt: s.createdAt.toISOString() });
  }

  dropOpen(conversationId: string): void {
    const sql = "DELETE FROM proposals WHERE conversation_id = ? AND status = ?";
    this.db.prepare(sql).run(conversationId, ProposalStatus.Open);
  }

  conversationsWithOpen(): Set<string> {
    const sql = "SELECT DISTINCT conversation_id AS id FROM proposals WHERE status = ?";
    const rows = this.db.prepare<[string], { id: string }>(sql).all(ProposalStatus.Open);
    return new Set(rows.map((row) => row.id));
  }
}

function toProposal(row: Row): Proposal {
  return Proposal.restore({
    id: row.id,
    conversationId: row.conversation_id,
    orderId: row.order_id,
    kind: row.kind as ProposalKind,
    reason: row.reason,
    quote: row.quote,
    basedOnMessageId: row.based_on_message_id,
    status: row.status as ProposalStatus,
    createdAt: new Date(row.created_at),
  });
}
