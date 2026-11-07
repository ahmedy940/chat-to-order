import { container } from "@/server/container";
import { respond, type IdParams } from "@/server/http";

/** The seller approves the agent's suggestion: it runs the same action as the order card's button. */
export function POST(_request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => container().approveProposal.execute((await params).id));
}
