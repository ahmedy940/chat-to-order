import { container } from "@/server/container";
import { respond, type IdParams } from "@/server/http";

/** Cancel an order before payment. Its pay link stops taking payment. */
export function POST(_request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => container().cancelOrder.execute((await params).id));
}
