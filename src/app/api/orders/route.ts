import { container } from "@/server/container";
import { respond } from "@/server/http";

/** The Orders tab: every order, newest first. */
export function GET(): Promise<Response> {
  return respond(() => container().listOrders.execute());
}
