import type { OrderSnapshot } from "@/domain/Order";
import type { DetailSnapshot } from "@/domain/OrderDetail";
import type { PaymentSnapshot, ShippingAddress } from "@/domain/Payment";
import type { DetailField, DetailStatus, OrderStatus } from "@/domain/types";

/** Table rows for an order, and the translation between rows and the domain's OrderSnapshot. */

export interface OrderRow {
  id: string;
  number: number;
  conversation_id: string;
  status: string;
  delivery_fee_cents: number | null;
  frozen_total_cents: number | null;
  pay_token: string | null;
  amount_mismatch: number;
}

export interface ItemRow {
  id: string;
  position: number;
}

export interface DetailRow {
  item_id: string | null;
  field: string;
  value: string | null;
  status: string;
  source_quote: string | null;
  offered_options_json: string | null;
}

export interface PaymentRow {
  paypal_order_id: string | null;
  attempt: number;
  paypal_status: string | null;
  capture_id: string | null;
  refund_id: string | null;
  payer_name: string | null;
  payer_email: string | null;
  ship_name: string | null;
  ship_address_json: string | null;
  captured_cents: number | null;
}

export interface OrderParts {
  row: OrderRow;
  items: ItemRow[];
  details: DetailRow[];
  payment: PaymentRow | undefined;
}

export function toSnapshot({ row, items, details, payment }: OrderParts): OrderSnapshot {
  const detailsOf = (itemId: string | null) => details.filter((d) => d.item_id === itemId).map(toDetail);
  const [deliveryFee] = detailsOf(null);
  if (!deliveryFee) throw new Error(`Order ${row.id} is missing its delivery fee row.`);
  return {
    id: row.id,
    number: row.number,
    conversationId: row.conversation_id,
    status: row.status as OrderStatus,
    items: items.map((item) => ({ id: item.id, position: item.position, details: detailsOf(item.id) })),
    deliveryFee,
    frozenTotalCents: row.frozen_total_cents,
    payToken: row.pay_token,
    payment: payment ? toPayment(payment) : null,
    amountMismatch: row.amount_mismatch === 1,
  };
}

function toDetail(row: DetailRow): DetailSnapshot {
  return {
    field: row.field as DetailField,
    value: row.value,
    status: row.status as DetailStatus,
    sourceQuote: row.source_quote,
    offeredOptions: row.offered_options_json ? (JSON.parse(row.offered_options_json) as string[]) : [],
  };
}

function toPayment(row: PaymentRow): PaymentSnapshot {
  const hasPayer = [row.payer_name, row.payer_email, row.ship_name, row.ship_address_json].some(Boolean);
  const shipAddress = row.ship_address_json ? (JSON.parse(row.ship_address_json) as ShippingAddress) : null;
  return {
    paypalOrderId: row.paypal_order_id,
    attempt: row.attempt,
    paypalStatus: row.paypal_status,
    captureId: row.capture_id,
    refundId: row.refund_id,
    payer: hasPayer
      ? { name: row.payer_name, email: row.payer_email, shipName: row.ship_name, shipAddress }
      : null,
    capturedCents: row.captured_cents,
  };
}

/** Named parameters for inserting one detail row. */
export function detailParams(orderId: string, itemId: string | null, detail: DetailSnapshot, at: string) {
  return {
    id: `${orderId}:${itemId ?? "order"}:${detail.field}`,
    orderId,
    itemId,
    field: detail.field,
    value: detail.value,
    status: detail.status,
    quote: detail.sourceQuote,
    options: JSON.stringify(detail.offeredOptions),
    at,
  };
}

/** Named parameters for upserting the payment row. */
export function paymentParams(orderId: string, payment: PaymentSnapshot) {
  const payer = payment.payer;
  return {
    id: `pay-${orderId}`,
    orderId,
    paypalOrderId: payment.paypalOrderId,
    attempt: payment.attempt,
    paypalStatus: payment.paypalStatus,
    captureId: payment.captureId,
    refundId: payment.refundId,
    payerName: payer?.name ?? null,
    payerEmail: payer?.email ?? null,
    shipName: payer?.shipName ?? null,
    shipAddress: payer?.shipAddress ? JSON.stringify(payer.shipAddress) : null,
    capturedCents: payment.capturedCents,
  };
}
