import { CURRENCY } from "./types";

/** The PayPal side of an order: which PayPal order, which capture, which refund, and who paid. */

const PAYPAL_COMPLETED = "COMPLETED";

export interface ShippingAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  countryCode: string | null;
}

export interface PayerDetails {
  name: string | null;
  email: string | null;
  shipName: string | null;
  shipAddress: ShippingAddress | null;
}

/** What PayPal reported after capturing a payment. */
export interface CaptureResult {
  paypalOrderId: string;
  captureId: string;
  status: string;
  amountCents: number;
  currency: string;
  payer: PayerDetails;
  feeCents: number | null;
  netCents: number | null;
}

/** What was wrong with a capture (status, currency or amount), or null when it matches the expected total. */
export function captureMismatch(capture: CaptureResult, expectedCents: number | null): string | null {
  const ok =
    capture.status === PAYPAL_COMPLETED &&
    capture.currency === CURRENCY &&
    capture.amountCents === expectedCents;
  return ok ? null : `${capture.status} ${capture.currency} ${(capture.amountCents / 100).toFixed(2)}`;
}

/** What PayPal reported after a refund. */
export interface RefundResult {
  refundId: string;
  status: string;
  amountCents: number;
}

export interface PaymentSnapshot {
  paypalOrderId: string | null;
  attempt: number;
  paypalStatus: string | null;
  captureId: string | null;
  refundId: string | null;
  payer: PayerDetails | null;
  capturedCents: number | null;
}

export class Payment {
  private constructor(private state: PaymentSnapshot) {}

  static start(): Payment {
    return new Payment({
      paypalOrderId: null,
      attempt: 0,
      paypalStatus: null,
      captureId: null,
      refundId: null,
      payer: null,
      capturedCents: null,
    });
  }

  static restore(snapshot: PaymentSnapshot): Payment {
    return new Payment({ ...snapshot });
  }

  get paypalOrderId(): string | null {
    return this.state.paypalOrderId;
  }

  get attempt(): number {
    return this.state.attempt;
  }

  get captureId(): string | null {
    return this.state.captureId;
  }

  get refundId(): string | null {
    return this.state.refundId;
  }

  get payer(): PayerDetails | null {
    return this.state.payer;
  }

  snapshot(): PaymentSnapshot {
    return { ...this.state };
  }

  /** A new PayPal order was created for this payment (the first, or a fresh one after the old one expired). */
  recordPayPalOrder(paypalOrderId: string, paypalStatus: string): void {
    this.state = { ...this.state, paypalOrderId, paypalStatus, attempt: this.state.attempt + 1 };
  }

  recordCapture(capture: CaptureResult): void {
    this.state = {
      ...this.state,
      paypalOrderId: capture.paypalOrderId,
      paypalStatus: capture.status,
      captureId: capture.captureId,
      payer: capture.payer,
      capturedCents: capture.amountCents,
    };
  }

  recordRefund(refund: RefundResult): void {
    this.state = { ...this.state, refundId: refund.refundId };
  }
}
