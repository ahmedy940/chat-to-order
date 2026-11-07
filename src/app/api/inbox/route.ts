import { container } from "@/server/container";
import { respond } from "@/server/http";

/** The seller's inbox. */
export function GET(): Promise<Response> {
  return respond(() => container().getInbox.execute());
}
