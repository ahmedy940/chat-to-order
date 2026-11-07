import type { CaptureResult, RefundResult } from "@/domain/Payment";

export interface PayPalOrderLine {
  name: string;
  quantity: number;
  unitAmountCents: number;
}

/** Everything PayPal needs to create an order, taken from our frozen order (never from the AI). */
export interface PayPalOrderRequest {
  referenceId: string;
  invoiceId: string;
  description: string;
  lines: PayPalOrderLine[];
  itemTotalCents: number;
  shippingCents: number;
  totalCents: number;
  brandName: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreatedPayPalOrder {
  paypalOrderId: string;
  status: string;
  /** Where the buyer approves the payment when not using PayPal's buttons (used by the sandbox check). */
  approveUrl: string | null;
}

/**
 * The payment provider, behind an interface so the rules are testable without PayPal.
 * Every write takes a request ID, so a retry or a double tap never charges or refunds twice.
 */
export interface PaymentGateway {
  createOrder(request: PayPalOrderRequest, requestId: string): Promise<CreatedPayPalOrder>;
  getOrderStatus(paypalOrderId: string): Promise<string>;
  capture(paypalOrderId: string, requestId: string): Promise<CaptureResult>;
  refund(captureId: string, requestId: string): Promise<RefundResult>;
}

/** PayPal said no, or couldn't be reached. `issue` is PayPal's code, such as INSTRUMENT_DECLINED. */
export class PaymentGatewayError extends Error {
  constructor(
    readonly issue: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PaymentGatewayError";
  }
}
