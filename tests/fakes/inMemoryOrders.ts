import type { DraftRepository } from "@/application/ports/DraftRepository";
import type { OrderEventRepository } from "@/application/ports/OrderEventRepository";
import type { OrderRepository } from "@/application/ports/OrderRepository";
import {
  PaymentGatewayError,
  type CreatedPayPalOrder,
  type PaymentGateway,
  type PayPalOrderRequest,
} from "@/application/ports/PaymentGateway";
import type { TokenFactory } from "@/application/ports/TokenFactory";
import { Draft, type DraftSnapshot } from "@/domain/Draft";
import { Order, type OrderSnapshot } from "@/domain/Order";
import type { NewOrderEvent, OrderEvent } from "@/domain/OrderEvent";
import type { CaptureResult, RefundResult } from "@/domain/Payment";
import { FIRST_ORDER_NUMBER } from "@/domain/types";

/** In-memory orders, timeline, drafts and a pretend PayPal, so payment rules are tested without PayPal. */

export class InMemoryOrders implements OrderRepository {
  private readonly rows: OrderSnapshot[] = [];
  private next = FIRST_ORDER_NUMBER;

  get(id: string): Order | null {
    return this.find((s) => s.id === id);
  }

  findByPayToken(payToken: string): Order | null {
    return this.find((s) => s.payToken === payToken);
  }

  latestForConversation(conversationId: string): Order | null {
    const mine = this.rows.filter((s) => s.conversationId === conversationId);
    const last = mine[mine.length - 1];
    return last ? Order.restore(structuredClone(last)) : null;
  }

  save(order: Order): void {
    const snapshot = structuredClone(order.snapshot());
    const index = this.rows.findIndex((s) => s.id === snapshot.id);
    if (index === -1) this.rows.push(snapshot);
    else this.rows[index] = snapshot;
  }

  nextNumber(): number {
    this.next += 1;
    return this.next - 1;
  }

  private find(match: (s: OrderSnapshot) => boolean): Order | null {
    const found = this.rows.find(match);
    return found ? Order.restore(structuredClone(found)) : null;
  }
}

export class InMemoryOrderEvents implements OrderEventRepository {
  readonly all: OrderEvent[] = [];

  append(orderId: string, event: NewOrderEvent, at: Date): OrderEvent {
    const seq = this.listByOrder(orderId).length + 1;
    const stamped = Object.freeze({ ...event, orderId, seq, at });
    this.all.push(stamped);
    return stamped;
  }

  listByOrder(orderId: string): OrderEvent[] {
    return this.all.filter((e) => e.orderId === orderId);
  }
}

export class InMemoryDrafts implements DraftRepository {
  private readonly rows = new Map<string, DraftSnapshot>();

  get(conversationId: string): Draft | null {
    const row = this.rows.get(conversationId);
    return row ? Draft.restore(row) : null;
  }

  save(draft: Draft): void {
    const s = draft.snapshot();
    this.rows.set(s.conversationId, s);
  }

  clear(conversationId: string): void {
    this.rows.delete(conversationId);
  }
}

export class CountingTokens implements TokenFactory {
  private next = 0;

  newPayToken(): string {
    this.next += 1;
    return `token-${this.next}`;
  }
}

/** A pretend PayPal. Like the real one, a repeated request ID returns the first answer. */
export class FakePaymentGateway implements PaymentGateway {
  readonly created: PayPalOrderRequest[] = [];
  /** Lets a test change what PayPal reports on capture (a different amount, for example). */
  captureOverride: Partial<CaptureResult> = {};
  private readonly orders = new Map<string, { status: string; totalCents: number }>();
  private readonly captures = new Map<string, CaptureResult>();

  createOrder(request: PayPalOrderRequest): Promise<CreatedPayPalOrder> {
    this.created.push(request);
    const paypalOrderId = `PAYPAL${String(this.created.length).padStart(4, "0")}`;
    this.orders.set(paypalOrderId, { status: "CREATED", totalCents: request.totalCents });
    return Promise.resolve({ paypalOrderId, status: "CREATED", approveUrl: null });
  }

  getOrderStatus(paypalOrderId: string): Promise<string> {
    const order = this.orders.get(paypalOrderId);
    if (!order) return Promise.reject(new PaymentGatewayError("RESOURCE_NOT_FOUND", "Not found", false));
    return Promise.resolve(order.status);
  }

  /** Marks a PayPal order as expired, so the next payment attempt needs a new one. */
  expire(paypalOrderId: string): void {
    const order = this.orders.get(paypalOrderId);
    if (order) order.status = "VOIDED";
  }

  capture(paypalOrderId: string, requestId: string): Promise<CaptureResult> {
    const earlier = this.captures.get(requestId);
    if (earlier) return Promise.resolve(earlier);
    const totalCents = this.orders.get(paypalOrderId)?.totalCents ?? 0;
    const result: CaptureResult = {
      paypalOrderId,
      captureId: `CAPTURE-${paypalOrderId}`,
      status: "COMPLETED",
      amountCents: totalCents,
      currency: "USD",
      payer: {
        name: "Sarah Lee",
        email: "sarah@example.com",
        shipName: "Sarah Lee",
        shipAddress: {
          line1: "1 Main St",
          line2: null,
          city: "Brooklyn",
          state: "NY",
          postalCode: "11201",
          countryCode: "US",
        },
      },
      feeCents: 410,
      netCents: totalCents - 410,
      ...this.captureOverride,
    };
    this.captures.set(requestId, result);
    return Promise.resolve(result);
  }

  refund(captureId: string): Promise<RefundResult> {
    return Promise.resolve({ refundId: `REFUND-${captureId}`, status: "COMPLETED", amountCents: 0 });
  }
}
