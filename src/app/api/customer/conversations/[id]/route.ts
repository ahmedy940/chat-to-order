import { container } from "@/server/container";
import { respond, type IdParams } from "@/server/http";

/** The customer phone's view of its chat. */
export function GET(_request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => container().getCustomerConversation.execute((await params).id));
}
