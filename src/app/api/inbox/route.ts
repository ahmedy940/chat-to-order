import { container } from "@/server/container";
import { respond } from "@/server/http";

/** The seller's inbox. The agent first looks at any new customer messages, so suggestions show with a dot. */
export function GET(): Promise<Response> {
  return respond(async () => {
    await container().proposeNextAction.runPending();
    return container().getInbox.execute();
  });
}
