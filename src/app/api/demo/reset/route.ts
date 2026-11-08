import { container } from "@/server/container";
import { respond } from "@/server/http";

/** Reset demo: clears everything and restarts order numbers at #1001. */
export function POST(): Promise<Response> {
  return respond(() => container().resetDemo.execute());
}
