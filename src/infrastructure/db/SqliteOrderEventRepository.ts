import type { OrderEventRepository } from "@/application/ports/OrderEventRepository";
import type { NewOrderEvent, OrderEvent } from "@/domain/OrderEvent";
import type { Actor, EventType } from "@/domain/types";
import type { Db } from "./database";

interface Row {
  order_id: string;
  seq: number;
  type: string;
  actor: string;
  summary: string;
  quote: string | null;
  amount_cents: number | null;
  fee_cents: number | null;
  net_cents: number | null;
  paypal_ref: string | null;
  created_at: string;
}

const INSERT = `
  INSERT INTO order_events (id, order_id, seq, type, actor, summary, quote, amount_cents, fee_cents, net_cents,
    paypal_ref, created_at)
  VALUES (@id, @orderId, @seq, @type, @actor, @summary, @quote, @amountCents, @feeCents, @netCents,
    @paypalRef, @createdAt)`;

/** The order timeline table. Append-only: this class has no update or delete. */
export class SqliteOrderEventRepository implements OrderEventRepository {
  constructor(private readonly db: Db) {}

  append(orderId: string, event: NewOrderEvent, at: Date): OrderEvent {
    const sql = "SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM order_events WHERE order_id = ?";
    const seq = this.db.prepare<[string], { seq: number }>(sql).get(orderId)?.seq ?? 1;
    const createdAt = at.toISOString();
    this.db.prepare(INSERT).run({ id: `${orderId}:${seq}`, orderId, seq, ...event, createdAt });
    return Object.freeze({ ...event, orderId, seq, at });
  }

  listByOrder(orderId: string): OrderEvent[] {
    return this.db
      .prepare<[string], Row>("SELECT * FROM order_events WHERE order_id = ? ORDER BY seq")
      .all(orderId)
      .map(toEvent);
  }
}

function toEvent(row: Row): OrderEvent {
  return Object.freeze({
    orderId: row.order_id,
    seq: row.seq,
    at: new Date(row.created_at),
    type: row.type as EventType,
    actor: row.actor as Actor,
    summary: row.summary,
    quote: row.quote,
    amountCents: row.amount_cents,
    feeCents: row.fee_cents,
    netCents: row.net_cents,
    paypalRef: row.paypal_ref,
  });
}
