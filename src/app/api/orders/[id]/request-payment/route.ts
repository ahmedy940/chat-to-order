import { container } from "@/server/container";
import { respond, type IdParams } from "@/server/http";

/** Freezes the order and creates its pay link and payment message draft. */
export function POST(_request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => container().requestPayment.execute((await params).id));
}
