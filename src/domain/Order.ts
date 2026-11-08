import { InvalidTransition, OrderLocked, OrderNotPayable, RefundNotAllowed, UnknownDetail } from "./errors";
import { Money } from "./Money";
import { OrderDetail } from "./OrderDetail";
import { balanceCents, newEvent, type NewOrderEvent } from "./OrderEvent";
import { OrderItem, withoutItem } from "./OrderItem";
import type { OrderReading, OrderSnapshot } from "./OrderSnapshot";
import { Payment, captureMismatch, isClearing, type CaptureResult, type RefundResult } from "./Payment";
import { Actor, EventType, ItemField, OrderField, OrderStatus, type DetailRef } from "./types";

export type { OrderReading, OrderSnapshot } from "./OrderSnapshot";

interface OrderState {
  status: OrderStatus;
  items: OrderItem[];
  deliveryFee: OrderDetail;
  frozenTotalCents: number | null;
  payToken: string | null;
  payment: Payment | null;
  amountMismatch: boolean;
}

const EDITABLE: readonly OrderStatus[] = [OrderStatus.Draft, OrderStatus.WaitingForCustomer];
const CANCELLABLE: readonly OrderStatus[] = [...EDITABLE, OrderStatus.AwaitingPayment];

/**
 * The order and every rule about it. Status changes happen only through these methods (illegal ones throw),
 * and each change returns the timeline event it caused.
 */
export class Order {
  private constructor(
    readonly id: string,
    readonly number: number,
    readonly conversationId: string,
    private readonly state: OrderState,
  ) {}

  static open(id: string, number: number, conversationId: string): Order {
    return new Order(id, number, conversationId, {
      status: OrderStatus.Draft,
      items: [],
      deliveryFee: OrderDetail.missing(OrderField.DeliveryFee),
      frozenTotalCents: null,
      payToken: null,
      payment: null,
      amountMismatch: false,
    });
  }

  static restore(s: OrderSnapshot): Order {
    return new Order(s.id, s.number, s.conversationId, {
      status: s.status,
      items: s.items.map((item) => OrderItem.restore(item)),
      deliveryFee: OrderDetail.restore(s.deliveryFee),
      frozenTotalCents: s.frozenTotalCents,
      payToken: s.payToken,
      payment: s.payment ? Payment.restore(s.payment) : null,
      amountMismatch: s.amountMismatch,
    });
  }

  /** Paid minus refunded, from the order's timeline. */
  static balance(events: readonly Pick<NewOrderEvent, "amountCents">[]): number {
    return balanceCents(events);
  }

  snapshot(): OrderSnapshot {
    const { items, deliveryFee, payment, ...rest } = this.state;
    return {
      id: this.id,
      number: this.number,
      conversationId: this.conversationId,
      ...rest,
      items: items.map((item) => item.snapshot()),
      deliveryFee: deliveryFee.snapshot(),
      payment: payment?.snapshot() ?? null,
    };
  }

  get status(): OrderStatus {
    return this.state.status;
  }

  get payToken(): string | null {
    return this.state.payToken;
  }

  get payment(): Payment | null {
    return this.state.payment;
  }

  get amountMismatch(): boolean {
    return this.state.amountMismatch;
  }

  items(): readonly OrderItem[] {
    return this.state.items;
  }

  deliveryFee(): OrderDetail {
    return this.state.deliveryFee;
  }

  /** Sum of quantity × unit price, plus the delivery fee. Frozen once payment is requested. */
  total(): Money {
    if (this.state.frozenTotalCents !== null) return Money.ofCents(this.state.frozenTotalCents);
    const items = this.state.items.reduce((sum, item) => sum.plus(item.lineTotal()), Money.zero());
    return items.plus(this.state.deliveryFee.money ?? Money.zero());
  }

  openDetails(): OrderDetail[] {
    const fee = this.state.deliveryFee.isOpen ? [this.state.deliveryFee] : [];
    return [...this.state.items.flatMap((item) => item.openDetails()), ...fee];
  }

  /** Open details the customer can be asked about: anything but a price. */
  askableDetails(): OrderDetail[] {
    return this.openDetails().filter((detail) => !detail.isSellerOnly);
  }

  isEditable(): boolean {
    return EDITABLE.includes(this.state.status);
  }

  /** Why payment can't be requested yet, or null when it can. */
  paymentBlocker(): string | null {
    if (!this.isEditable()) return `This order is ${this.state.status}.`;
    if (this.state.items.length === 0) return "Add an item first.";
    const open = this.openDetails().length;
    if (open > 0) return `${open} to settle before requesting payment.`;
    return this.total().isPositive() ? null : "The total must be above $0.";
  }

  canRequestPayment(): boolean {
    return this.paymentBlocker() === null;
  }

  /** The seller starts filling in the card by hand. */
  addBlankItem(itemId: string): OrderItem {
    this.assertEditable();
    const item = OrderItem.blank(itemId, this.state.items.length);
    this.state.items.push(item);
    return item;
  }

  /** The seller removes an item line, for example one added by mistake. The last item can't go. */
  removeItem(itemId: string): { event: NewOrderEvent; removed: OrderItem } {
    this.assertEditable();
    const { items, removed, index } = withoutItem(this.state.items, itemId);
    this.state.items = items;
    const product = removed.detail(ItemField.Product)?.value;
    const summary = `Item ${index + 1} removed${product ? ` (${product})` : ""}`;
    return { event: newEvent(EventType.ItemRemoved, Actor.Seller, summary), removed };
  }

  /** Merges what the AI read, item by item. Seller-set values are never overwritten. */
  applyReading(reading: OrderReading, newItemId: () => string): NewOrderEvent {
    this.assertEditable();
    reading.items.forEach((itemReading, index) => {
      (this.state.items[index] ?? this.addBlankItem(newItemId())).applyReading(itemReading);
    });
    if (reading.deliveryFee) this.state.deliveryFee.applyReading(reading.deliveryFee);
    const summary = `Order read: ${this.state.items.length} item(s), ${this.openDetails().length} to settle`;
    return newEvent(EventType.OrderRead, Actor.Ai, summary);
  }

  settle(ref: DetailRef, value: string): NewOrderEvent {
    this.assertEditable();
    const detail = this.detailAt(ref);
    detail.setBySeller(value);
    const shown = detail.money?.format() ?? detail.value;
    return newEvent(EventType.DetailSet, Actor.Seller, `${detail.label} set to ${shown}`);
  }

  askCustomer(ref: DetailRef, options: readonly string[]): void {
    this.assertEditable();
    this.detailAt(ref).askCustomer(options);
  }

  /** The customer tapped an offered option. Null when that option wasn't offered for this detail. */
  answerOption(ref: DetailRef, option: string): NewOrderEvent | null {
    this.assertEditable();
    const detail = this.detailAt(ref);
    if (!detail.answerFromCustomer(option, option)) return null;
    this.customerReplied();
    return newEvent(EventType.DetailSet, Actor.Customer, `${detail.label} from customer: ${option}`, {
      quote: option,
    });
  }

  /** Any customer message hands a waiting order back to the seller. */
  customerReplied(): void {
    if (this.state.status === OrderStatus.WaitingForCustomer) this.state.status = OrderStatus.Draft;
  }

  markQuestionSent(text: string): NewOrderEvent {
    this.assertEditable();
    this.state.status = OrderStatus.WaitingForCustomer;
    return newEvent(EventType.QuestionSent, Actor.Seller, "Question sent to the customer", { quote: text });
  }

  /** Freezes the items and the total and opens the pay link. Requesting twice opens one link. */
  requestPayment(payToken: string, actor: Actor = Actor.Seller): NewOrderEvent | null {
    if (this.state.status === OrderStatus.AwaitingPayment) return null;
    const blocker = this.paymentBlocker();
    if (blocker) throw new OrderNotPayable(blocker);
    const total = this.total();
    Object.assign(this.state, {
      status: OrderStatus.AwaitingPayment,
      frozenTotalCents: total.cents,
      payToken,
      payment: Payment.start(),
    });
    return newEvent(EventType.PaymentRequested, actor, `Payment requested: ${total.format()}`);
  }

  recordPayPalOrder(paypalOrderId: string, paypalStatus: string): void {
    this.assertStatus(OrderStatus.AwaitingPayment, "attach a PayPal order to");
    this.requirePayment().recordPayPalOrder(paypalOrderId, paypalStatus);
  }

  /** Paid only when PayPal completed exactly the frozen total in US dollars. Capturing twice changes nothing. */
  markPaid(capture: CaptureResult): NewOrderEvent | null {
    if (this.state.status === OrderStatus.Paid && this.state.payment?.captureId === capture.captureId)
      return null;
    this.assertStatus(OrderStatus.AwaitingPayment, "mark as paid");
    const mismatch = captureMismatch(capture, this.state.frozenTotalCents);
    if (mismatch !== null) return this.flagMismatch(capture.captureId, mismatch);
    this.requirePayment().recordCapture(capture);
    Object.assign(this.state, { status: OrderStatus.Paid, amountMismatch: false });
    const { amountCents, feeCents, netCents, captureId: paypalRef } = capture;
    const clearing = isClearing(capture.status) ? " (PayPal is still clearing it)" : "";
    const summary = `Paid by ${capture.payer.name ?? "the customer"}${clearing}`;
    return newEvent(EventType.PaymentCaptured, Actor.PayPal, summary, {
      amountCents,
      feeCents,
      netCents,
      paypalRef,
    });
  }

  assertRefundable(): void {
    if (this.state.status !== OrderStatus.Paid) throw new RefundNotAllowed(this.state.status);
  }

  /** Full refund. Refunding twice changes nothing. */
  markRefunded(refund: RefundResult, actor: Actor = Actor.Seller): NewOrderEvent | null {
    if (this.state.status === OrderStatus.Refunded) return null;
    this.assertRefundable();
    this.requirePayment().recordRefund(refund);
    this.state.status = OrderStatus.Refunded;
    const summary = `Refunded ${Money.ofCents(refund.amountCents).format()}`;
    return newEvent(EventType.RefundIssued, actor, summary, {
      amountCents: -refund.amountCents,
      paypalRef: refund.refundId,
    });
  }

  /** PayPal refused the refund. The order stays Paid. */
  refundFailed(reason: string): NewOrderEvent {
    this.assertRefundable();
    return newEvent(EventType.RefundFailed, Actor.PayPal, `Refund failed: ${reason}`);
  }

  /** Before payment only: once money has moved, the way back is a refund. */
  canCancel(): boolean {
    return CANCELLABLE.includes(this.state.status);
  }

  /** Cancels before payment. Cancelling twice changes nothing. */
  cancel(actor: Actor = Actor.Seller): NewOrderEvent | null {
    if (this.state.status === OrderStatus.Cancelled) return null;
    if (!this.canCancel()) throw new InvalidTransition(this.state.status, "cancel");
    this.state.status = OrderStatus.Cancelled;
    return newEvent(EventType.OrderCancelled, actor, "Order cancelled");
  }

  private detailAt(ref: DetailRef): OrderDetail {
    if (ref.field === OrderField.DeliveryFee) return this.state.deliveryFee;
    const item = this.state.items.find((candidate) => candidate.id === ref.itemId);
    if (!item) throw new UnknownDetail();
    return item.detailFor(ref.field);
  }

  /** Money arrived but not as expected: stay Awaiting payment and flag it for the seller. */
  private flagMismatch(captureId: string, got: string): NewOrderEvent {
    this.state.amountMismatch = true;
    const summary = `Payment amount mismatch, check PayPal (${got})`;
    return newEvent(EventType.PaymentMismatch, Actor.PayPal, summary, { paypalRef: captureId });
  }

  private assertEditable(): void {
    if (this.isEditable()) return;
    throw this.state.status === OrderStatus.Cancelled
      ? new InvalidTransition(this.state.status, "change")
      : new OrderLocked();
  }

  private assertStatus(expected: OrderStatus, action: string): void {
    if (this.state.status !== expected) throw new InvalidTransition(this.state.status, action);
  }

  private requirePayment(): Payment {
    this.state.payment ??= Payment.start();
    return this.state.payment;
  }
}
