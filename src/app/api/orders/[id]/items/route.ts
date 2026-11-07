import { container } from "@/server/container";
import { respond, type IdParams } from "@/server/http";

/** The seller adds another item line to the order card. */
export function POST(_request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => container().addItem.execute((await params).id));
}
