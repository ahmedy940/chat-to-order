import { container } from "@/server/container";
import { respond, type IdParams } from "@/server/http";

/** The seller starts an order card by hand (or gets the conversation's open one). */
export function POST(_request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => container().startOrder.execute((await params).id));
}
