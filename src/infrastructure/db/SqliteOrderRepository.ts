import type { OrderRepository } from "@/application/ports/OrderRepository";
import { Order } from "@/domain/Order";
import type { Db } from "./database";
import {
  detailParams,
  paymentParams,
  toSnapshot,
  type DetailRow,
  type ItemRow,
  type OrderRow,
  type PaymentRow,
} from "./orderRows";

const UPSERT_ORDER = `
  INSERT INTO orders (id, number, conversation_id, status, delivery_fee_cents, frozen_total_cents, pay_token,
    amount_mismatch, created_at, updated_at)
  VALUES (@id, @number, @conversationId, @status, @deliveryFeeCents, @frozenTotalCents, @payToken,
    @amountMismatch, @at, @at)
  ON CONFLICT(id) DO UPDATE SET status = excluded.status, delivery_fee_cents = excluded.delivery_fee_cents,
    frozen_total_cents = excluded.frozen_total_cents, pay_token = excluded.pay_token,
    amount_mismatch = excluded.amount_mismatch, updated_at = excluded.updated_at`;

const INSERT_DETAIL = `
  INSERT INTO order_details (id, order_id, item_id, field, value, status, source_quote, offered_options_json, updated_at)
  VALUES (@id, @orderId, @itemId, @field, @value, @status, @quote, @options, @at)`;

const UPSERT_PAYMENT = `
  INSERT INTO payments (id, order_id, paypal_order_id, attempt, paypal_status, capture_id, refund_id,
    payer_name, payer_email, ship_name, ship_address_json, captured_cents)
  VALUES (@id, @orderId, @paypalOrderId, @attempt, @paypalStatus, @captureId, @refundId,
    @payerName, @payerEmail, @shipName, @shipAddress, @capturedCents)
  ON CONFLICT(order_id) DO UPDATE SET paypal_order_id = excluded.paypal_order_id, attempt = excluded.attempt,
    paypal_status = excluded.paypal_status, capture_id = excluded.capture_id, refund_id = excluded.refund_id,
    payer_name = excluded.payer_name, payer_email = excluded.payer_email, ship_name = excluded.ship_name,
    ship_address_json = excluded.ship_address_json, captured_cents = excluded.captured_cents`;

/** Saves an order with its items, details and payment, and loads it back as the same domain Order. */
export class SqliteOrderRepository implements OrderRepository {
  constructor(private readonly db: Db) {}

  get(id: string): Order | null {
    return this.load(this.db.prepare<[string], OrderRow>("SELECT * FROM orders WHERE id = ?").get(id));
  }

  findByPayToken(payToken: string): Order | null {
    const sql = "SELECT * FROM orders WHERE pay_token = ?";
    return this.load(this.db.prepare<[string], OrderRow>(sql).get(payToken));
  }

  latestForConversation(conversationId: string): Order | null {
    const sql = "SELECT * FROM orders WHERE conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1";
    return this.load(this.db.prepare<[string], OrderRow>(sql).get(conversationId));
  }

  listForConversation(conversationId: string): Order[] {
    const sql = "SELECT * FROM orders WHERE conversation_id = ? ORDER BY created_at, rowid";
    const rows = this.db.prepare<[string], OrderRow>(sql).all(conversationId);
    return rows.flatMap((row) => this.load(row) ?? []);
  }

  save(order: Order): void {
    this.db.transaction(() => this.write(order))();
  }

  nextNumber(): number {
    return this.db.transaction(() => {
      const sql = "SELECT next_value FROM sequences WHERE name = 'order_number'";
      const next = this.db.prepare<[], { next_value: number }>(sql).get()?.next_value ?? 1001;
      this.db.prepare("UPDATE sequences SET next_value = ? WHERE name = 'order_number'").run(next + 1);
      return next;
    })();
  }

  private write(order: Order): void {
    const s = order.snapshot();
    const at = new Date().toISOString();
    this.db.prepare(UPSERT_ORDER).run({
      id: s.id,
      number: s.number,
      conversationId: s.conversationId,
      status: s.status,
      deliveryFeeCents: order.deliveryFee().money?.cents ?? null,
      frozenTotalCents: s.frozenTotalCents,
      payToken: s.payToken,
      amountMismatch: s.amountMismatch ? 1 : 0,
      at,
    });
    this.writeItems(s.id, s, at);
    if (s.payment) this.db.prepare(UPSERT_PAYMENT).run(paymentParams(s.id, s.payment));
  }

  /** Items and details are replaced as a whole: simpler than diffing, and an order has only a few rows. */
  private writeItems(orderId: string, s: ReturnType<Order["snapshot"]>, at: string): void {
    this.db.prepare("DELETE FROM order_details WHERE order_id = ?").run(orderId);
    this.db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);
    const insertItem = this.db.prepare("INSERT INTO order_items (id, order_id, position) VALUES (?, ?, ?)");
    const insertDetail = this.db.prepare(INSERT_DETAIL);
    for (const item of s.items) {
      insertItem.run(item.id, orderId, item.position);
      for (const detail of item.details) insertDetail.run(detailParams(orderId, item.id, detail, at));
    }
    insertDetail.run(detailParams(orderId, null, s.deliveryFee, at));
  }

  private load(row: OrderRow | undefined): Order | null {
    if (!row) return null;
    const items = this.db
      .prepare<[string], ItemRow>("SELECT id, position FROM order_items WHERE order_id = ? ORDER BY position")
      .all(row.id);
    const details = this.db
      .prepare<[string], DetailRow>("SELECT * FROM order_details WHERE order_id = ?")
      .all(row.id);
    const payment = this.db
      .prepare<[string], PaymentRow>("SELECT * FROM payments WHERE order_id = ?")
      .get(row.id);
    return Order.restore(toSnapshot({ row, items, details, payment }));
  }
}
