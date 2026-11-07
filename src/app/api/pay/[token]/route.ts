import { container } from "@/server/container";
import { respond, type TokenParams } from "@/server/http";

/** The pay page's data: the frozen order and whether it can still be paid. */
export function GET(_request: Request, { params }: TokenParams): Promise<Response> {
  return respond(async () => container().getPayPage.execute((await params).token));
}
