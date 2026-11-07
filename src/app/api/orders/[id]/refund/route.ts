import { container } from "@/server/container";
import { respond, type IdParams } from "@/server/http";

/** Full refund of a paid order through PayPal. Pressing it twice refunds once. */
export function POST(_request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => container().refundPayment.execute((await params).id));
}
