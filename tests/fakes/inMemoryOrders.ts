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
    return this.listForConversation(conversationId).at(-1) ?? null;
  }

  listForConversation(conversationId: string): Order[] {
    return this.rows
      .filter((s) => s.conversationId === conversationId)
      .map((s) => Order.restore(structuredClone(s)));
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
    const order = this.orders.get(paypalOrderId);
    if (order) order.status = "COMPLETED"; // like PayPal: a captured order is COMPLETED, even if still clearing
    return Promise.resolve(result);
  }

  /** Set to make PayPal refuse refunds, as it does past the refund window. */
  refuseRefunds = false;
  refundCalls = 0;
  private readonly refunds = new Map<string, RefundResult>();

  /** A full refund of the captured amount. A repeated request ID returns the first refund, not a second one. */
  refund(captureId: string, requestId: string): Promise<RefundResult> {
    this.refundCalls += 1;
    if (this.refuseRefunds) {
      const reason = "This capture is past its refund window.";
      return Promise.reject(new PaymentGatewayError("REFUND_TIME_LIMIT_EXCEEDED", reason, false));
    }
    const earlier = this.refunds.get(requestId);
    if (earlier) return Promise.resolve(earlier);
    const captured = [...this.captures.values()].find((c) => c.captureId === captureId);
    const refund = {
      refundId: `REFUND-${captureId}`,
      status: "COMPLETED",
      amountCents: captured?.amountCents ?? 0,
    };
    this.refunds.set(requestId, refund);
    return Promise.resolve(refund);
  }
}
