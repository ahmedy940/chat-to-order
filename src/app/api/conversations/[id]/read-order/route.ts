import { container } from "@/server/container";
import { respond, type IdParams } from "@/server/http";

/** Read order: the AI fills in the order card from the chat. */
export function POST(_request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => container().readOrder.execute((await params).id));
}
