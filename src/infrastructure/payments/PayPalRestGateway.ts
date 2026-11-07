import {
  PaymentGatewayError,
  type CreatedPayPalOrder,
  type PaymentGateway,
  type PayPalOrderRequest,
} from "@/application/ports/PaymentGateway";
import { Money } from "@/domain/Money";
import type { CaptureResult, RefundResult } from "@/domain/Payment";
import { toCaptureResult, toCreateOrderBody, toGatewayError } from "./paypalMapping";
import {
  CaptureResponseSchema,
  CreateOrderSchema,
  OrderStatusSchema,
  RefundResponseSchema,
  TokenSchema,
} from "./paypalSchemas";

export const PAYPAL_SANDBOX_URL = "https://api-m.sandbox.paypal.com";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

const TIMEOUT_MS = 15_000;
const TOKEN_SAFETY_MS = 60_000;
const APPROVE_RELS = ["payer-action", "approve"];

/** PayPal's REST APIs with plain fetch: OAuth token, Orders v2 (create, get, capture), Payments v2 (refund). */
export class PayPalRestGateway implements PaymentGateway {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: PayPalConfig,
    private readonly now: () => number = Date.now,
  ) {}

  async createOrder(request: PayPalOrderRequest, requestId: string): Promise<CreatedPayPalOrder> {
    const body = toCreateOrderBody(request);
    const data = CreateOrderSchema.parse(await this.call("POST", "/v2/checkout/orders", body, requestId));
    const approve = data.links.find((link) => APPROVE_RELS.includes(link.rel));
    return { paypalOrderId: data.id, status: data.status, approveUrl: approve?.href ?? null };
  }

  async getOrderStatus(paypalOrderId: string): Promise<string> {
    const path = `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`;
    return OrderStatusSchema.parse(await this.call("GET", path)).status;
  }

  async capture(paypalOrderId: string, requestId: string): Promise<CaptureResult> {
    const path = `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`;
    return toCaptureResult(CaptureResponseSchema.parse(await this.call("POST", path, {}, requestId)));
  }

  /** An empty body means a full refund. */
  async refund(captureId: string, requestId: string): Promise<RefundResult> {
    const path = `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`;
    const data = RefundResponseSchema.parse(await this.call("POST", path, {}, requestId));
    return {
      refundId: data.id,
      status: data.status,
      amountCents: Money.fromPayPalValue(data.amount.value).cents,
    };
  }

  private async call(method: string, path: string, body?: object, requestId?: string): Promise<unknown> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await this.accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    if (requestId) headers["PayPal-Request-Id"] = requestId;
    const init = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };
    return this.read(await this.send(`${this.config.baseUrl}${path}`, init));
  }

  /** OAuth client-credentials token, cached until shortly before it expires. */
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const response = await this.send(`${this.config.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    const data = TokenSchema.parse(await this.read(response));
    this.token = {
      value: data.access_token,
      expiresAt: this.now() + data.expires_in * 1000 - TOKEN_SAFETY_MS,
    };
    return data.access_token;
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new PaymentGatewayError("UNREACHABLE", "PayPal is not responding. Try again.", true);
    }
  }

  private async read(response: Response): Promise<unknown> {
    const data: unknown = await response.json().catch(() => ({}));
    if (response.ok) return data;
    throw toGatewayError(response.status, data);
  }
}
