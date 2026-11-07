import type { Draft } from "@/domain/Draft";
import { formatSignedCents, Money } from "@/domain/Money";
import { Order } from "@/domain/Order";
import type { OrderDetail } from "@/domain/OrderDetail";
import type { OrderEvent } from "@/domain/OrderEvent";
import type { OrderItem } from "@/domain/OrderItem";
import type { PayerDetails, ShippingAddress } from "@/domain/Payment";
import {
  ACTOR_LABELS,
  FIELD_LABELS,
  ITEM_FIELD_ORDER,
  ORDER_STATUS_LABELS,
  SELLER_ONLY_FIELDS,
  type DetailField,
  type DetailStatus,
  type DraftKind,
  type OrderStatus,
} from "@/domain/types";
import type { PayUrl } from "../ports/TokenFactory";

export interface DetailView {
  itemId: string | null;
  field: DetailField;
  label: string;
  value: string | null;
  /** The value as shown: "$60.00" for prices. */
  display: string | null;
  /** "optional": a colour or size not on this item yet; the seller can still type one. */
  status: DetailStatus | "optional";
  quote: string | null;
  sellerOnly: boolean;
}

export interface ItemView {
  id: string;
  details: DetailView[];
  lineTotal: string;
}

export interface PaymentView {
  payUrl: string | null;
  paypalOrderId: string | null;
  captureId: string | null;
  refundId: string | null;
  payerName: string | null;
  payerEmail: string | null;
  shipName: string | null;
  shipAddress: string | null;
}

export interface TimelineLine {
  seq: number;
  at: string;
  actor: string;
  summary: string;
  quote: string | null;
  /** "+$128.00" or "−$128.00" for money lines. */
  amount: string | null;
  fee: string | null;
  net: string | null;
  paypalRef: string | null;
}

export interface OrderView {
  id: string;
  number: number;
  status: OrderStatus;
  statusLabel: string;
  editable: boolean;
  items: ItemView[];
  deliveryFee: DetailView;
  total: string;
  paymentBlocker: string | null;
  amountMismatch: boolean;
  payment: PaymentView | null;
  timeline: TimelineLine[];
  /** Paid minus refunded. */
  balance: string;
}

export interface DraftView {
  id: string;
  kind: DraftKind;
  text: string;
}

export function toOrderView(order: Order, events: OrderEvent[], payUrl: PayUrl): OrderView {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    editable: order.isEditable(),
    items: order.items().map(toItemView),
    deliveryFee: toDetailView(order.deliveryFee(), null),
    total: order.total().format(),
    paymentBlocker: order.paymentBlocker(),
    amountMismatch: order.amountMismatch,
    payment: toPaymentView(order, payUrl),
    timeline: events.map(toTimelineLine),
    balance: Money.ofCents(Order.balance(events)).format(),
  };
}

export function toDraftView(draft: Draft | null): DraftView | null {
  return draft ? { id: draft.id, kind: draft.kind, text: draft.text } : null;
}

/** "2211 N First St, San Jose, CA 95131, US" */
export function formatAddress(address: ShippingAddress | null): string | null {
  if (!address) return null;
  const region = [address.state, address.postalCode].filter(Boolean).join(" ");
  const parts = [address.line1, address.line2, address.city, region, address.countryCode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function toItemView(item: OrderItem): ItemView {
  const details = ITEM_FIELD_ORDER.map((field) => {
    const detail = item.detail(field);
    return detail ? toDetailView(detail, item.id) : optionalDetail(item.id, field);
  });
  return { id: item.id, details, lineTotal: item.lineTotal().format() };
}

function toDetailView(detail: OrderDetail, itemId: string | null): DetailView {
  const s = detail.snapshot();
  return {
    itemId,
    field: s.field,
    label: detail.label,
    value: s.value,
    display: detail.money?.format() ?? s.value,
    status: s.status,
    quote: s.sourceQuote,
    sellerOnly: detail.isSellerOnly,
  };
}

function optionalDetail(itemId: string, field: DetailField): DetailView {
  const sellerOnly = SELLER_ONLY_FIELDS.includes(field);
  const label = FIELD_LABELS[field];
  return { itemId, field, label, value: null, display: null, status: "optional", quote: null, sellerOnly };
}

function toPaymentView(order: Order, payUrl: PayUrl): PaymentView | null {
  const payment = order.payment?.snapshot();
  if (!payment || !order.payToken) return null;
  return {
    payUrl: payUrl(order.payToken),
    paypalOrderId: payment.paypalOrderId,
    captureId: payment.captureId,
    refundId: payment.refundId,
    ...toPayerView(payment.payer),
  };
}

/** Who paid, from PayPal: blank until the payment is captured. */
function toPayerView(payer: PayerDetails | null) {
  if (!payer) return { payerName: null, payerEmail: null, shipName: null, shipAddress: null };
  const { name, email, shipName, shipAddress } = payer;
  return { payerName: name, payerEmail: email, shipName, shipAddress: formatAddress(shipAddress) };
}

function toTimelineLine(event: OrderEvent): TimelineLine {
  const money = (cents: number | null) => (cents === null ? null : Money.ofCents(cents).format());
  return {
    seq: event.seq,
    at: event.at.toISOString(),
    actor: ACTOR_LABELS[event.actor],
    summary: event.summary,
    quote: event.quote,
    amount: event.amountCents === null ? null : formatSignedCents(event.amountCents),
    fee: money(event.feeCents),
    net: money(event.netCents),
    paypalRef: event.paypalRef,
  };
}
