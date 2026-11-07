import { container } from "@/server/container";
import { respond, type IdParams } from "@/server/http";

/** The seller dismisses the agent's suggestion until the customer writes again. */
export function POST(_request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => container().dismissProposal.execute((await params).id));
}
