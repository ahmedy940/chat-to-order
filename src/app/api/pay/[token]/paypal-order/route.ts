import { container } from "@/server/container";
import { respond, type TokenParams } from "@/server/http";

/** PayPal's button asks for an order to pay: create one from the frozen order, or reuse the open one. */
export function POST(_request: Request, { params }: TokenParams): Promise<Response> {
  return respond(async () => container().preparePayPalOrder.execute((await params).token));
}
