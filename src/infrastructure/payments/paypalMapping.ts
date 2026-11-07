import { PaymentGatewayError, type PayPalOrderRequest } from "@/application/ports/PaymentGateway";
import { Money } from "@/domain/Money";
import type { CaptureResult, PayerDetails, ShippingAddress } from "@/domain/Payment";
import { CURRENCY } from "@/domain/types";
import {
  PayPalErrorSchema,
  type CaptureResponse,
  type PayPalAddress,
  type PayPalErrorBody,
  type PayPalPayer,
} from "./paypalSchemas";

/** Translates between our order shapes and PayPal's Orders v2 payloads. */

const usd = (cents: number) => ({ currency_code: CURRENCY, value: Money.ofCents(cents).toPayPalValue() });
const MAX_ITEM_NAME = 127;

function toPurchaseUnit(request: PayPalOrderRequest) {
  return {
    reference_id: request.referenceId,
    invoice_id: request.invoiceId,
    description: request.description,
    items: request.lines.map((line) => ({
      name: line.name.slice(0, MAX_ITEM_NAME),
      quantity: String(line.quantity),
      unit_amount: usd(line.unitAmountCents),
      category: "PHYSICAL_GOODS",
    })),
    amount: {
      ...usd(request.totalCents),
      breakdown: { item_total: usd(request.itemTotalCents), shipping: usd(request.shippingCents) },
    },
  };
}

export function toCreateOrderBody(request: PayPalOrderRequest) {
  const experience_context = {
    brand_name: request.brandName,
    // Take the buyer's name and address from their PayPal account, so the chat never has to ask.
    shipping_preference: "GET_FROM_FILE",
    user_action: "PAY_NOW",
    return_url: request.returnUrl,
    cancel_url: request.cancelUrl,
  };
  return {
    intent: "CAPTURE",
    purchase_units: [toPurchaseUnit(request)],
    payment_source: { paypal: { experience_context } },
  };
}

const centsOrNull = (value: string | undefined) =>
  value === undefined ? null : Money.fromPayPalValue(value).cents;
const orNull = (value: string | undefined) => value ?? null;

function fullName(payer: PayPalPayer | undefined): string | null {
  const name = [payer?.name?.given_name, payer?.name?.surname].filter(Boolean).join(" ");
  return name === "" ? null : name;
}

function toAddress(address: PayPalAddress | undefined): ShippingAddress | null {
  if (!address) return null;
  return {
    line1: orNull(address.address_line_1),
    line2: orNull(address.address_line_2),
    city: orNull(address.admin_area_2),
    state: orNull(address.admin_area_1),
    postalCode: orNull(address.postal_code),
    countryCode: orNull(address.country_code),
  };
}

function toPayer(data: CaptureResponse): PayerDetails {
  const shipping = data.purchase_units[0]?.shipping;
  return {
    name: fullName(data.payer),
    email: orNull(data.payer?.email_address),
    shipName: orNull(shipping?.name?.full_name),
    shipAddress: toAddress(shipping?.address),
  };
}

export function toCaptureResult(data: CaptureResponse): CaptureResult {
  const capture = data.purchase_units[0]?.payments?.captures[0];
  if (!capture) throw new PaymentGatewayError("NO_CAPTURE", "PayPal didn't return a capture.", false);
  const breakdown = capture.seller_receivable_breakdown;
  return {
    paypalOrderId: data.id,
    captureId: capture.id,
    status: capture.status,
    amountCents: Money.fromPayPalValue(capture.amount.value).cents,
    currency: capture.amount.currency_code,
    payer: toPayer(data),
    feeCents: centsOrNull(breakdown?.paypal_fee?.value),
    netCents: centsOrNull(breakdown?.net_amount?.value),
  };
}

const issueOf = (error: PayPalErrorBody, status: number) =>
  error.details?.[0]?.issue ?? error.name ?? `HTTP_${status}`;
const messageOf = (error: PayPalErrorBody) =>
  error.details?.[0]?.description ?? error.message ?? "PayPal refused.";
const isRetryable = (status: number) => status >= 500 || status === 429;

/** Turns a PayPal error response into one error with PayPal's issue code and a readable message. */
export function toGatewayError(httpStatus: number, body: unknown): PaymentGatewayError {
  const parsed = PayPalErrorSchema.safeParse(body);
  const error: PayPalErrorBody = parsed.success ? parsed.data : {};
  return new PaymentGatewayError(issueOf(error, httpStatus), messageOf(error), isRetryable(httpStatus));
}
