import { container } from "@/server/container";
import { respond, type IdParams } from "@/server/http";

/** The seller's view of one conversation. The agent first looks at a new customer message, if there is one. */
export function GET(_request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => {
    const { id } = await params;
    await container().proposeNextAction.execute(id);
    return container().getSellerConversation.execute(id);
  });
}
