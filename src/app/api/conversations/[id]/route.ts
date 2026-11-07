import { container } from "@/server/container";
import { respond, type IdParams } from "@/server/http";

/** The seller's view of one conversation. */
export function GET(_request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => container().getSellerConversation.execute((await params).id));
}
